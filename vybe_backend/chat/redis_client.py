import redis
import logging
import json
import os
import asyncio
import sys
from django.conf import settings

logger = logging.getLogger(__name__)

class MatchmakingState:
    def __init__(self):
        self.use_redis = False
        redis_url = os.environ.get('REDIS_URL')
        redis_host = os.environ.get('REDIS_HOST', '127.0.0.1')
        redis_port = int(os.environ.get('REDIS_PORT', 6379))
        
        # Always initialize in-memory fallbacks so they exist
        self._online_users = {}  # user_id -> {sid, username, role}
        self._queue = []         # list of user_id
        self._active_matches = {} # user_id -> partner_user_id
        self._previous_partners = {} # user_id -> set of previous partner user_ids
        self._sid_to_uid = {}    # sid -> user_id
        self._blocked_users = {} # user_id -> set of blocked user_ids
        self._local_lock = asyncio.Lock()
        
        # Test Redis connection
        try:
            if redis_url:
                self.r = redis.Redis.from_url(
                    redis_url,
                    socket_connect_timeout=2,
                    decode_responses=True
                )
            else:
                self.r = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=0,
                    socket_connect_timeout=2,
                    decode_responses=True
                )
            self.r.ping()
            self.use_redis = True
            logger.info("Connected to Redis successfully for matchmaking.")
        except Exception as e:
            is_testing = 'test' in sys.argv
            if not getattr(settings, 'DEBUG', True) and not is_testing:
                logger.critical(f"REDIS CONNECTION FAILED IN PRODUCTION: {e}")
                sys.exit("Critical Error: Redis connection is mandatory in production environment.")
            else:
                logger.warning(f"Could not connect to Redis: {e}. Falling back to in-memory matchmaking state.")

    async def acquire_match_lock(self, token, timeout=5):
        if self.use_redis:
            try:
                import time
                start_time = time.time()
                while time.time() - start_time < 2:
                    acquired = self.r.set("lock:matchmaking", token, ex=timeout, nx=True)
                    if acquired:
                        return True
                    await asyncio.sleep(0.05)
                return False
            except Exception as e:
                logger.error(f"Error acquiring Redis lock: {e}")
                return False
        else:
            await self._local_lock.acquire()
            return True

    async def release_match_lock(self, token):
        if self.use_redis:
            try:
                lua_release = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                self.r.eval(lua_release, 1, "lock:matchmaking", token)
            except Exception as e:
                logger.error(f"Error releasing Redis lock: {e}")
        else:
            if self._local_lock.locked():
                self._local_lock.release()

    def _handle_redis_error(self, e):
        is_testing = 'test' in sys.argv
        if not getattr(settings, 'DEBUG', True) and not is_testing:
            logger.critical(f"Redis error encountered in production: {e}")
            sys.exit("Critical Error: Redis failure is fatal in production.")
        else:
            logger.error(f"Redis connection lost during active operation: {e}. Switching to in-memory fallback state.")
            self.use_redis = False


    # ONLINE USERS
    def add_online_user(self, user_id, sid, username, role, gender='UNSPECIFIED', gender_filter='ALL', connection_id=None, match_mode='VIDEO'):
        user_id = str(user_id)
        data = {
            'sid': sid,
            'username': username,
            'role': role,
            'gender': gender,
            'gender_filter': gender_filter,
            'connection_id': connection_id,
            'match_mode': match_mode
        }
        
        # Keep in-memory mirror updated in case of unexpected fallback
        self._online_users[user_id] = data
        self._sid_to_uid[sid] = user_id

        if self.use_redis:
            try:
                self.r.hset("online_users", user_id, json.dumps(data))
                self.r.hset("sid_to_uid", sid, user_id)
            except Exception as e:
                self._handle_redis_error(e)

    def remove_online_user(self, sid):
        user_id = None
        if self.use_redis:
            try:
                user_id = self.r.hget("sid_to_uid", sid)
                if user_id:
                    online_data = self.r.hget("online_users", user_id)
                    if online_data:
                        data = json.loads(online_data)
                        if data.get('sid') == sid:
                            self.r.hdel("online_users", user_id)
                    self.r.hdel("sid_to_uid", sid)
            except Exception as e:
                self._handle_redis_error(e)
                user_id = self._sid_to_uid.get(sid)
        else:
            user_id = self._sid_to_uid.get(sid)

        if user_id:
            current_user = self._online_users.get(user_id)
            if current_user and current_user.get('sid') == sid:
                self._online_users.pop(user_id, None)
            self._sid_to_uid.pop(sid, None)
            return user_id
        return None

    def get_online_user(self, user_id):
        user_id = str(user_id)
        if self.use_redis:
            try:
                data = self.r.hget("online_users", user_id)
                return json.loads(data) if data else None
            except Exception as e:
                self._handle_redis_error(e)
                return self._online_users.get(user_id)
        else:
            return self._online_users.get(user_id)

    # MATCHMAKING QUEUE
    def join_queue(self, user_id):
        user_id = str(user_id)
        if user_id not in self._queue:
            self._queue.append(user_id)

        if self.use_redis:
            try:
                import time
                self.r.zadd("match_queue", {user_id: time.time()}, nx=True)
            except Exception as e:
                self._handle_redis_error(e)

    def leave_queue(self, user_id):
        user_id = str(user_id)
        if user_id in self._queue:
            self._queue.remove(user_id)

        if self.use_redis:
            try:
                self.r.zrem("match_queue", user_id)
            except Exception as e:
                self._handle_redis_error(e)

    def get_queue(self):
        if self.use_redis:
            try:
                return self.r.zrange("match_queue", 0, -1)
            except Exception as e:
                self._handle_redis_error(e)
                return list(self._queue)
        else:
            return list(self._queue)

    # ACTIVE MATCHES
    def set_match(self, user1, user2):
        u1, u2 = str(user1), str(user2)
        self._active_matches[u1] = u2
        self._active_matches[u2] = u1
        
        if u1 not in self._previous_partners:
            self._previous_partners[u1] = set()
        self._previous_partners[u1].add(u2)
        if u2 not in self._previous_partners:
            self._previous_partners[u2] = set()
        self._previous_partners[u2].add(u1)

        if self.use_redis:
            try:
                self.r.hset("active_matches", u1, u2)
                self.r.hset("active_matches", u2, u1)
                self.r.sadd(f"prev_partners:{u1}", u2)
                self.r.sadd(f"prev_partners:{u2}", u1)
            except Exception as e:
                self._handle_redis_error(e)

    def get_partner(self, user_id):
        user_id = str(user_id)
        if self.use_redis:
            try:
                return self.r.hget("active_matches", user_id)
            except Exception as e:
                self._handle_redis_error(e)
                return self._active_matches.get(user_id)
        else:
            return self._active_matches.get(user_id)

    def clear_match(self, user_id):
        u1 = str(user_id)
        u2 = self.get_partner(u1)
        
        self._active_matches.pop(u1, None)
        if u2:
            self._active_matches.pop(u2, None)

        if self.use_redis:
            try:
                self.r.hdel("active_matches", u1)
                if u2:
                    self.r.hdel("active_matches", u2)
            except Exception as e:
                self._handle_redis_error(e)
        return u2

    def get_previous_partners(self, user_id):
        user_id = str(user_id)
        if self.use_redis:
            try:
                return set(self.r.smembers(f"prev_partners:{user_id}"))
            except Exception as e:
                self._handle_redis_error(e)
                return self._previous_partners.get(user_id, set())
        else:
            return self._previous_partners.get(user_id, set())

    # BLOCKED USERS
    def block_user(self, user_id, blocked_id):
        u1, u2 = str(user_id), str(blocked_id)
        if u1 not in self._blocked_users:
            self._blocked_users[u1] = set()
        self._blocked_users[u1].add(u2)

        if self.use_redis:
            try:
                self.r.sadd(f"blocked_users:{u1}", u2)
            except Exception as e:
                self._handle_redis_error(e)

    def is_blocked(self, user_id, target_id):
        u1, u2 = str(user_id), str(target_id)
        if self.use_redis:
            try:
                is_u1_blocked_u2 = self.r.sismember(f"blocked_users:{u1}", u2)
                is_u2_blocked_u1 = self.r.sismember(f"blocked_users:{u2}", u1)
                return is_u1_blocked_u2 or is_u2_blocked_u1
            except Exception as e:
                self._handle_redis_error(e)
                # use in-memory fallback check
                is_u1_blocked_u2 = u2 in self._blocked_users.get(u1, set())
                is_u2_blocked_u1 = u1 in self._blocked_users.get(u2, set())
                return is_u1_blocked_u2 or is_u2_blocked_u1
        else:
            is_u1_blocked_u2 = u2 in self._blocked_users.get(u1, set())
            is_u2_blocked_u1 = u1 in self._blocked_users.get(u2, set())
            return is_u1_blocked_u2 or is_u2_blocked_u1

# Global Matchmaking State Instance
state = MatchmakingState()
