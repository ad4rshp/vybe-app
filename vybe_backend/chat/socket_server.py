import socketio
import urllib.parse
import logging
from rest_framework_simplejwt.tokens import AccessToken
from users.models import User, AccountStatus, SuspendedIp
from asgiref.sync import sync_to_async
from .redis_client import state
from django.utils import timezone

@sync_to_async
def is_ip_suspended(ip):
    if not ip:
        return False
    return SuspendedIp.objects.filter(ip_address=ip, suspended_until__gt=timezone.now()).exists()

logger = logging.getLogger(__name__)

import uuid
from django.db import transaction
from users.models import CreditTransaction, TransactionType

@sync_to_async
def check_user_credits(user_id, min_credits=5):
    """Checks if a user has at least min_credits."""
    try:
        user = User.objects.get(id=user_id)
        return user.credits >= min_credits
    except User.DoesNotExist:
        return False

@sync_to_async
def try_create_match_and_charge(user1_id, user2_id, match_id):
    """
    Atomically charges both users if they have a paid gender filter (MALE/FEMALE).
    If either fails, the transaction rolls back, and no charges are applied.
    Returns (True, u1_credits, u2_credits) or (False, failed_user_id).
    """
    from django.conf import settings
    FILTER_MATCH_COST = getattr(settings, 'FILTER_MATCH_COST', 5)
    try:
        with transaction.atomic():
            ids = sorted([int(user1_id), int(user2_id)])
            users_map = {u.id: u for u in User.objects.select_for_update().filter(id__in=ids)}
            u1 = users_map.get(int(user1_id))
            u2 = users_map.get(int(user2_id))
            if not u1 or not u2:
                return False, int(user1_id)
            if u1.gender_filter in ['MALE', 'FEMALE'] and u1.role != 'ADMIN':
                if u1.credits < FILTER_MATCH_COST:
                    return False, u1.id
                u1.credits -= FILTER_MATCH_COST
                u1.save(update_fields=['credits'])
                CreditTransaction.objects.create(
                    user=u1,
                    amount=-FILTER_MATCH_COST,
                    balance_after=u1.credits,
                    transaction_type=TransactionType.FILTER_MATCH,
                    reference_id=match_id
                )
            if u2.gender_filter in ['MALE', 'FEMALE'] and u2.role != 'ADMIN':
                if u2.credits < FILTER_MATCH_COST:
                    return False, u2.id
                u2.credits -= FILTER_MATCH_COST
                u2.save(update_fields=['credits'])
                CreditTransaction.objects.create(
                    user=u2,
                    amount=-FILTER_MATCH_COST,
                    balance_after=u2.credits,
                    transaction_type=TransactionType.FILTER_MATCH,
                    reference_id=match_id
                )
            return True, None
    except Exception as e:
        logger.error(f"Error in transaction charge: {e}")
        return False, int(user1_id)


# Initialize Socket.IO async server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

import time
import asyncio

@sync_to_async
def get_user_from_token(token_str):
    try:
        access_token = AccessToken(token_str)
        user_id = access_token['user_id']
        exp_timestamp = access_token.get('exp')
        user = User.objects.get(id=user_id)
        
        # Check moderation status
        if user.is_banned:
            return None, "BANNED", None
        if user.is_suspended:
            return None, "SUSPENDED", None
        if not user.email_verified:
            return None, "EMAIL_UNVERIFIED", None
            
        return user, None, exp_timestamp
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        return None, "INVALID_TOKEN", None

@sync_to_async
def log_telemetry_event(event_type, user_id):
    try:
        from reports.models import TelemetryEvent
        TelemetryEvent.objects.create(event_type=event_type, user_id=user_id)
    except Exception as e:
        logger.error(f"Error logging telemetry event: {e}")

@sio.event
async def connect(sid, environ, auth=None):
    # Extract client IP and verify suspension status
    x_forwarded_for = environ.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = environ.get('REMOTE_ADDR')
        
    if await is_ip_suspended(ip):
        logger.warning(f"Connection rejected: IP {ip} is suspended. Sid: {sid}")
        return False

    logger.info(f"Socket connection attempt: {sid}")
    
    # Extract token from query parameters or auth headers
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get('token')
        
    if not token:
        query_string = environ.get('QUERY_STRING', '')
        params = urllib.parse.parse_qs(query_string)
        token_list = params.get('token')
        if token_list:
            token = token_list[0]
            
    if not token:
        cookie_str = environ.get('HTTP_COOKIE', '')
        import http.cookies
        try:
            cookie = http.cookies.SimpleCookie()
            cookie.load(cookie_str)
            if 'access_token' in cookie:
                token = cookie['access_token'].value
        except Exception as e:
            logger.error(f"Error parsing cookie for WebSocket: {e}")
            
    if not token:
        logger.warning(f"Connection rejected: No token provided. Sid: {sid}")
        return False
        
    user, error, exp = await get_user_from_token(token)
    if error:
        logger.warning(f"Connection rejected: {error}. Sid: {sid}")
        return False
        
    user_id = str(user.id)
    conn_id = str(uuid.uuid4())
    
    # Clean up any existing connection for this user first
    existing = state.get_online_user(user_id)
    if existing:
        try:
            await sio.disconnect(existing['sid'])
        except Exception:
            pass
            
    # Add to online users
    state.add_online_user(user_id, sid, user.username, user.role, user.gender, user.gender_filter, connection_id=conn_id, match_mode=user.match_mode)
    await sio.save_session(sid, {
        'user_id': user_id,
        'username': user.username,
        'role': user.role,
        'gender': user.gender,
        'gender_filter': user.gender_filter,
        'match_mode': user.match_mode,
        'exp': exp,
        'connection_id': conn_id
    })
    
    await log_telemetry_event('CONNECT', int(user_id))
    
    logger.info(f"User connected: {user.username} ({user_id}), Connection ID: {conn_id}, Sid: {sid}")
    return True

async def monitor_token_expiry():
    """Periodically checks connected client sessions and disconnects those with expired JWTs."""
    logger.info("Starting WebSocket token expiry monitor task...")
    while True:
        try:
            await asyncio.sleep(45)  # check every 45 seconds
            active_sids = list(sio.eio.sockets.keys())
            current_time = time.time()
            for sid in active_sids:
                try:
                    session = await sio.get_session(sid)
                    if session:
                        exp = session.get('exp')
                        if exp and current_time > exp:
                            logger.warning(f"Disconnecting SID {sid} for User {session.get('username')} - JWT expired.")
                            await sio.emit('auth:expired', {'message': 'Session expired. Please log in again.'}, to=sid)
                            await sio.disconnect(sid)
                except Exception as ex:
                    logger.debug(f"Error checking session expiry for SID {sid}: {ex}")
        except Exception as e:
            logger.error(f"Error in monitor_token_expiry background loop: {e}")

# Start the background monitor task only when running the actual ASGI server
import sys
is_mgmt = any(arg in sys.argv for arg in ['makemigrations', 'migrate', 'showmigrations', 'test', 'shell', 'reset_db'])
if not is_mgmt:
    sio.start_background_task(monitor_token_expiry)


async def terminate_match(user_id, reason='match_ended', requeue_partner=True):
    """
    Idempotently terminates the active match for user_id.
    Returns partner_id if successfully terminated, else None.
    """
    user_id = str(user_id)
    partner_id = state.get_partner(user_id)
    if not partner_id:
        return None

    cleared_partner_id = state.clear_match(user_id)
    if not cleared_partner_id:
        return None

    partner = state.get_online_user(cleared_partner_id)
    if partner:
        logger.info(f"Idempotent match terminate for user {user_id} -> partner {cleared_partner_id} ({reason})")
        await sio.emit('chat:disconnect', {'reason': reason}, to=partner['sid'])
        if requeue_partner:
            state.join_queue(cleared_partner_id)
            await sio.emit('queue:status', {'status': 'SEARCHING'}, to=partner['sid'])
            await run_matchmaking(cleared_partner_id)

    return cleared_partner_id

@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    conn_id = session.get('connection_id') if session else None
    
    if not user_id:
        state.remove_online_user(sid)
        return

    # Check connection ID
    current_user_state = state.get_online_user(user_id)
    if current_user_state:
        current_conn_id = current_user_state.get('connection_id')
        if current_conn_id and current_conn_id != conn_id:
            logger.info(f"Ignoring stale disconnect for User {user_id} (Session Conn: {conn_id}, Active Conn: {current_conn_id})")
            state.remove_online_user(sid)
            return

    logger.info(f"User disconnected: {user_id}, Sid: {sid}")
    await log_telemetry_event('DISCONNECT', int(user_id))
    state.remove_online_user(sid)
    state.leave_queue(user_id)
    await terminate_match(user_id, reason='partner_disconnected', requeue_partner=True)

@sio.on('queue:join')
async def join_queue(sid, data=None):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    
    @sync_to_async
    def get_latest_user_settings(uid):
        try:
            u = User.objects.get(id=uid)
            return u.gender_filter, u.match_mode, u.gender
        except User.DoesNotExist:
            return 'ALL', 'VIDEO', 'UNSPECIFIED'

    gender_filter, match_mode, gender = await get_latest_user_settings(user_id)
    
    # Update socket session
    session['gender_filter'] = gender_filter
    session['match_mode'] = match_mode
    session['gender'] = gender
    await sio.save_session(sid, session)
    
    # Update online user state
    user_online = state.get_online_user(user_id)
    if user_online:
        state.add_online_user(
            user_id=user_id,
            sid=sid,
            username=user_online['username'],
            role=user_online['role'],
            gender=gender,
            gender_filter=gender_filter,
            connection_id=user_online.get('connection_id'),
            match_mode=match_mode
        )
    
    # Check credits sufficiency at entry for paid gender filter, do not deduct yet
    if gender_filter in ('MALE', 'FEMALE') and session.get('role') != 'ADMIN':
        try:
            from django.conf import settings
            sufficient_cost = getattr(settings, 'FILTER_MATCH_COST', 5)
            sufficient = await check_user_credits(user_id, sufficient_cost)
            if not sufficient:
                logger.warning(f"User {session['username']} has insufficient credits to join filtered queue.")
                await sio.emit('credits:insufficient', {
                    'message': 'Not enough tokens for gender-filtered matching. Visit the Shop to get more tokens.'
                }, to=sid)
                return
        except Exception as e:
            logger.error(f"Credit check error: {e}")
            return
    
    logger.info(f"User {session['username']} joining matchmaking queue")
    state.join_queue(user_id)
    await sio.emit('queue:status', {'status': 'SEARCHING'}, to=sid)
    
    # Trigger Matchmaking Loop
    await run_matchmaking(user_id)

@sio.on('queue:leave')
async def leave_queue(sid, data=None):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    
    logger.info(f"User {session['username']} leaving matchmaking queue")
    state.leave_queue(user_id)
    await sio.emit('queue:status', {'status': 'IDLE'}, to=sid)

async def run_matchmaking(user_id):
    user_id = str(user_id)
    lock_token = str(uuid.uuid4())
    
    # 1. Acquire match lock
    if not await state.acquire_match_lock(lock_token):
        logger.warning(f"Failed to acquire matchmaking lock for user {user_id}")
        return

    try:
        user_online = state.get_online_user(user_id)
        if not user_online:
            return
            
        queue = state.get_queue()
        if user_id not in queue:
            return
            
        # Verify user is not already matched
        if state.get_partner(user_id):
            return

        # Look for candidate
        prev_partners = state.get_previous_partners(user_id)
        match_candidate = None
        
        for candidate in queue:
            if candidate == user_id:
                continue
                
            candidate_online = state.get_online_user(candidate)
            if not candidate_online:
                state.leave_queue(candidate)
                continue
                
            # Verify candidate is not already matched
            if state.get_partner(candidate):
                state.leave_queue(candidate)
                continue
                
            # Avoid immediate rematch unless testing locally with very few users in the queue
            if candidate in prev_partners:
                if len(queue) > 2:
                    continue

            # Avoid blocked users
            if state.is_blocked(user_id, candidate):
                continue

            # Avoid matching mode mismatches (VIDEO vs TEXT)
            user_mode = user_online.get('match_mode', 'VIDEO')
            candidate_mode = candidate_online.get('match_mode', 'VIDEO')
            if user_mode != candidate_mode:
                continue

            # Avoid gender mismatches (Symmetric preference check)
            user_gender = user_online.get('gender', 'UNSPECIFIED')
            user_pref = user_online.get('gender_filter', 'ALL')
            
            candidate_gender = candidate_online.get('gender', 'UNSPECIFIED')
            candidate_pref = candidate_online.get('gender_filter', 'ALL')
            
            if user_pref != 'ALL' and candidate_gender != user_pref:
                continue
            if candidate_pref != 'ALL' and user_gender != candidate_pref:
                continue
                
            match_candidate = candidate
            break

        if match_candidate:
            # Generate a unique match reference ID
            match_id = f"match_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            
            # Atomic PostgreSQL transaction matching charge
            charged, detail = await try_create_match_and_charge(user_id, match_candidate, match_id)
            if not charged:
                failed_uid = str(detail)
                logger.warning(f"Credit charge failed for user {failed_uid} during match creation.")
                
                # Remove failed user from queue
                state.leave_queue(failed_uid)
                failed_online = state.get_online_user(failed_uid)
                if failed_online:
                    await sio.emit('credits:insufficient', {
                        'message': 'Not enough tokens for gender-filtered matching. Visit the Shop to get more tokens.'
                    }, to=failed_online['sid'])
                    await sio.emit('queue:status', {'status': 'IDLE'}, to=failed_online['sid'])

                # Release lock and re-trigger matchmaking for the eligible partner
                eligible_uid = user_id if failed_uid == match_candidate else match_candidate
                await state.release_match_lock(lock_token)
                await run_matchmaking(eligible_uid)
                return

            # Match found and charged successfully! Remove both from queue
            state.leave_queue(user_id)
            state.leave_queue(match_candidate)
            
            # Set active match
            state.set_match(user_id, match_candidate)
            
            # Release lock before doing network emits (reduces critical section size)
            await state.release_match_lock(lock_token)
            
            user_sid = user_online['sid']
            candidate_online = state.get_online_user(match_candidate)
            candidate_sid = candidate_online['sid']
            
            logger.info(f"Match established: {user_online['username']} ({user_id}) <-> {candidate_online['username']} ({match_candidate}) with Match ID: {match_id}")
            
            await log_telemetry_event('MATCH_FOUND', int(user_id))
            await log_telemetry_event('MATCH_FOUND', int(match_candidate))
            
            await sio.emit('match:found', {
                'peerId': match_candidate,
                'peerUsername': candidate_online['username'],
                'initiator': True
            }, to=user_sid)
            
            await sio.emit('match:found', {
                'peerId': user_id,
                'peerUsername': user_online['username'],
                'initiator': False
            }, to=candidate_sid)
            return
            
    finally:
        # Safely release the lock in the finally block
        await state.release_match_lock(lock_token)

@sio.on('webrtc:offer')
async def webrtc_offer(sid, data):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    partner_id = state.get_partner(user_id)
    if not partner_id:
        logger.warning(f"Rejected unauthorized WebRTC offer from user {user_id} - no active partner.")
        return

    target_user = state.get_online_user(partner_id)
    if target_user:
        offer = data.get('offer')
        await sio.emit('webrtc:offer', {
            'offer': offer,
            'sender': user_id
        }, to=target_user['sid'])

@sio.on('webrtc:answer')
async def webrtc_answer(sid, data):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    partner_id = state.get_partner(user_id)
    if not partner_id:
        logger.warning(f"Rejected unauthorized WebRTC answer from user {user_id} - no active partner.")
        return

    target_user = state.get_online_user(partner_id)
    if target_user:
        answer = data.get('answer')
        await sio.emit('webrtc:answer', {
            'answer': answer,
            'sender': user_id
        }, to=target_user['sid'])

@sio.on('webrtc:ice-candidate')
async def webrtc_ice_candidate(sid, data):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    partner_id = state.get_partner(user_id)
    if not partner_id:
        logger.warning(f"Rejected unauthorized WebRTC ice-candidate from user {user_id} - no active partner.")
        return

    target_user = state.get_online_user(partner_id)
    if target_user:
        candidate = data.get('candidate')
        await sio.emit('webrtc:ice-candidate', {
            'candidate': candidate,
            'sender': user_id
        }, to=target_user['sid'])

@sio.on('chat:next')
async def chat_next(sid, data=None):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    
    logger.info(f"User {session['username']} skipped current partner")
    
    partner_id = await terminate_match(user_id, reason='partner_left', requeue_partner=True)
    if partner_id:
        await log_telemetry_event('SKIP', int(user_id))
            
    # Put current user back in queue
    state.join_queue(user_id)
    await sio.emit('queue:status', {'status': 'SEARCHING'}, to=sid)
    await run_matchmaking(user_id)

@sio.on('chat:message')
async def chat_message(sid, data):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    username = session['username']
    text = data.get('text') if isinstance(data, dict) else data
    if not text:
        return
        
    partner_id = state.get_partner(user_id)
    if partner_id:
        partner = state.get_online_user(partner_id)
        if partner:
            await sio.emit('chat:message', {
                'sender': username,
                'text': text
            }, to=partner['sid'])

@sio.on('chat:block')
async def chat_block(sid, data=None):
    session = await sio.get_session(sid)
    if not session:
        return
    user_id = session['user_id']
    
    partner_id = await terminate_match(user_id, reason='partner_left', requeue_partner=True)
    if partner_id:
        state.block_user(user_id, partner_id)
        logger.info(f"User {session['username']} blocked {partner_id}")
            
    state.join_queue(user_id)
    await sio.emit('queue:status', {'status': 'SEARCHING'}, to=sid)
    await run_matchmaking(user_id)

@sio.on('monitor:join')
async def monitor_join(sid, data):
    session = await sio.get_session(sid)
    if not session or session.get('role') != 'ADMIN':
        logger.warning(f"Unauthorized monitor:join attempt from sid {sid}")
        return
        
    target_id = str(data.get('target_id'))
    partner_id = state.get_partner(target_id)
    
    target_user = state.get_online_user(target_id)
    partner_user = state.get_online_user(partner_id) if partner_id else None
    
    if target_user:
        await sio.emit('webrtc:request-monitor', {'monitor_sid': sid, 'stream_label': 'target'}, to=target_user['sid'])
    if partner_user:
        await sio.emit('webrtc:request-monitor', {'monitor_sid': sid, 'stream_label': 'partner'}, to=partner_user['sid'])
    
    logger.info(f"Admin {session['username']} started monitoring active match of user {target_id}")

@sio.on('webrtc:monitor-offer')
async def webrtc_monitor_offer(sid, data):
    monitor_sid = data.get('monitor_sid')
    offer = data.get('offer')
    stream_label = data.get('stream_label')
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    
    await sio.emit('webrtc:monitor-offer', {
        'offer': offer,
        'sender_id': user_id,
        'sender_sid': sid,
        'stream_label': stream_label
    }, to=monitor_sid)

@sio.on('webrtc:monitor-candidate')
async def webrtc_monitor_candidate(sid, data):
    monitor_sid = data.get('monitor_sid')
    candidate = data.get('candidate')
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    
    await sio.emit('webrtc:monitor-candidate', {
        'candidate': candidate,
        'sender_id': user_id,
        'sender_sid': sid
    }, to=monitor_sid)

@sio.on('webrtc:monitor-answer')
async def webrtc_monitor_answer(sid, data):
    target_sid = data.get('target_sid')
    answer = data.get('answer')
    await sio.emit('webrtc:monitor-answer', {
        'answer': answer,
        'monitor_sid': sid
    }, to=target_sid)

