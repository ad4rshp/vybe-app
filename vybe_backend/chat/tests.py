from django.test import TransactionTestCase, override_settings
from django.db import IntegrityError, transaction
from users.models import User, CreditTransaction, TransactionType
from chat.redis_client import MatchmakingState
import chat.socket_server as ss
import asyncio
import uuid
import time
import sys

class MockSocketServer:
    def __init__(self):
        self.emitted = []
        self.sessions = {}

    async def emit(self, event, data, to=None):
        self.emitted.append((event, data, to))

    async def save_session(self, sid, session):
        self.sessions[sid] = session

    async def get_session(self, sid):
        return self.sessions.get(sid, {})

class VybeIntegrityTestCase(TransactionTestCase):
    def setUp(self):
        # Create test users
        self.u1 = User.objects.create_user(username="user1", email="u1@vybe.chat", password="pass123", credits=100)
        self.u2 = User.objects.create_user(username="user2", email="u2@vybe.chat", password="pass123", credits=100)
        self.u3 = User.objects.create_user(username="user3", email="u3@vybe.chat", password="pass123", credits=100)
        
        # Setup mock socket server
        self.mock_sio = MockSocketServer()
        ss.sio = self.mock_sio
        self.mock_sio.emitted = []
        
        # Reset matchmaking state
        ss.state._online_users = {}
        ss.state._queue = []
        ss.state._active_matches = {}
        ss.state._previous_partners = {}
        ss.state._sid_to_uid = {}
        ss.state._blocked_users = {}

    def test_credits_cannot_become_negative(self):
        # Verify db constraint triggers IntegrityError on negative credits
        self.u1.credits = -5
        with self.assertRaises(IntegrityError):
            self.u1.save()

    def test_all_filter_match_costs_zero_credits(self):
        # User 1 filter: ALL, User 2 filter: ALL
        self.u1.gender_filter = 'ALL'
        self.u2.gender_filter = 'ALL'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_1"
        success, detail = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))
        
        self.assertTrue(success)
        self.u1.refresh_from_db()
        self.u2.refresh_from_db()
        self.assertEqual(self.u1.credits, 100)
        self.assertEqual(self.u2.credits, 100)
        self.assertEqual(CreditTransaction.objects.filter(reference_id=match_id).count(), 0)

    def test_male_filter_charges_five_credits(self):
        # User 1 filter: MALE, User 2 filter: ALL
        self.u1.gender_filter = 'MALE'
        self.u2.gender_filter = 'ALL'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_2"
        success, detail = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))

        self.assertTrue(success)
        self.u1.refresh_from_db()
        self.u2.refresh_from_db()
        self.assertEqual(self.u1.credits, 95)
        self.assertEqual(self.u2.credits, 100)

        # Check transaction ledger
        tx = CreditTransaction.objects.get(user=self.u1, reference_id=match_id)
        self.assertEqual(tx.amount, -5)
        self.assertEqual(tx.balance_after, 95)
        self.assertEqual(tx.transaction_type, TransactionType.FILTER_MATCH)

    def test_female_filter_charges_five_credits(self):
        # User 1 filter: FEMALE, User 2 filter: ALL
        self.u1.gender_filter = 'FEMALE'
        self.u2.gender_filter = 'ALL'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_3"
        success, detail = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))

        self.assertTrue(success)
        self.u1.refresh_from_db()
        self.assertEqual(self.u1.credits, 95)

    def test_only_the_user_requesting_paid_filter_is_charged(self):
        self.u1.gender_filter = 'MALE'
        self.u2.gender_filter = 'ALL'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_4"
        success, detail = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))

        self.assertTrue(success)
        self.u1.refresh_from_db()
        self.u2.refresh_from_db()
        self.assertEqual(self.u1.credits, 95)
        self.assertEqual(self.u2.credits, 100)
        self.assertEqual(CreditTransaction.objects.filter(user=self.u2, reference_id=match_id).count(), 0)

    def test_two_paid_filter_users_are_charged_independently(self):
        self.u1.gender_filter = 'MALE'
        self.u2.gender_filter = 'FEMALE'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_5"
        success, detail = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))

        self.assertTrue(success)
        self.u1.refresh_from_db()
        self.u2.refresh_from_db()
        self.assertEqual(self.u1.credits, 95)
        self.assertEqual(self.u2.credits, 95)
        self.assertEqual(CreditTransaction.objects.filter(reference_id=match_id).count(), 2)

    def test_same_match_reference_cannot_charge_the_same_user_twice(self):
        self.u1.gender_filter = 'MALE'
        self.u2.gender_filter = 'ALL'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_double"
        success1, detail1 = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))
        self.assertTrue(success1)

        # Attempt to charge again with same reference_id
        success2, detail2 = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))
        self.assertFalse(success2)

    def test_failed_match_creation_does_not_leave_charge_without_ledger(self):
        self.u1.gender_filter = 'MALE'
        self.u1.credits = 4  # Insufficient
        self.u2.gender_filter = 'ALL'
        self.u1.save()
        self.u2.save()

        match_id = "test_match_fail"
        success, failed_uid = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))

        self.assertFalse(success)
        self.assertEqual(failed_uid, self.u1.id)
        # Verify no credits deducted from database row
        self.u1.refresh_from_db()
        self.assertEqual(self.u1.credits, 4)
        self.assertEqual(CreditTransaction.objects.filter(reference_id=match_id).count(), 0)

    def test_insufficient_credits_during_match_creation_does_not_charge_eligible_partner(self):
        self.u1.gender_filter = 'MALE'
        self.u1.credits = 4  # Insufficient
        self.u2.gender_filter = 'FEMALE' # Eligible paid user
        self.u1.save()
        self.u2.save()

        match_id = "test_match_fail_partner"
        success, detail = asyncio.run(ss.try_create_match_and_charge(self.u1.id, self.u2.id, match_id))

        self.assertFalse(success)
        self.u2.refresh_from_db()
        # Partner should not be charged
        self.assertEqual(self.u2.credits, 100)
        self.assertEqual(CreditTransaction.objects.filter(reference_id=match_id).count(), 0)

    def test_duplicate_queue_joins_create_only_one_entry(self):
        state = ss.state
        state.join_queue(self.u1.id)
        state.join_queue(self.u1.id)

        queue = state.get_queue()
        self.assertEqual(len(queue), 1)
        self.assertEqual(queue[0], str(self.u1.id))

    def test_user_cannot_send_webrtc_offer_to_non_partner(self):
        state = ss.state
        session_u1 = {'user_id': str(self.u1.id), 'username': self.u1.username}
        asyncio.run(ss.sio.save_session('sid1', session_u1))

        asyncio.run(ss.webrtc_offer('sid1', {'offer': 'sdp_payload', 'target': str(self.u2.id)}))
        self.assertEqual(len(self.mock_sio.emitted), 0)

    def test_user_cannot_send_webrtc_answer_to_non_partner(self):
        session_u1 = {'user_id': str(self.u1.id), 'username': self.u1.username}
        asyncio.run(ss.sio.save_session('sid1', session_u1))
        asyncio.run(ss.webrtc_answer('sid1', {'answer': 'sdp_payload', 'target': str(self.u2.id)}))
        self.assertEqual(len(self.mock_sio.emitted), 0)

    def test_user_cannot_send_ice_candidates_to_non_partner(self):
        session_u1 = {'user_id': str(self.u1.id), 'username': self.u1.username}
        asyncio.run(ss.sio.save_session('sid1', session_u1))
        asyncio.run(ss.webrtc_ice_candidate('sid1', {'candidate': 'ice_payload', 'target': str(self.u2.id)}))
        self.assertEqual(len(self.mock_sio.emitted), 0)

    def test_client_supplied_target_ids_cannot_override_server_active_partner(self):
        state = ss.state
        state.set_match(self.u1.id, self.u2.id) # u1 matched with u2
        state.add_online_user(self.u1.id, 'sid1', self.u1.username, 'USER')
        state.add_online_user(self.u2.id, 'sid2', self.u2.username, 'USER')
        state.add_online_user(self.u3.id, 'sid3', self.u3.username, 'USER')

        session_u1 = {'user_id': str(self.u1.id), 'username': self.u1.username}
        asyncio.run(ss.sio.save_session('sid1', session_u1))

        # Send offer specifying target u3 (attempt to hijack signaling to u3)
        asyncio.run(ss.webrtc_offer('sid1', {'offer': 'sdp_payload', 'target': str(self.u3.id)}))

        # Check emitted target: should be routed ONLY to u2 ('sid2'), ignoring u3
        self.assertEqual(len(self.mock_sio.emitted), 1)
        event, payload, to = self.mock_sio.emitted[0]
        self.assertEqual(event, 'webrtc:offer')
        self.assertEqual(to, 'sid2')  # Sent to server-side matched partner, not client target!

    def test_reconnect_with_new_socket_is_not_removed_by_stale_disconnect_cleanup(self):
        conn1_id = "conn_id_1"
        ss.state.add_online_user(self.u1.id, 'sid1', self.u1.username, 'USER', connection_id=conn1_id)
        session1 = {'user_id': str(self.u1.id), 'username': self.u1.username, 'connection_id': conn1_id}
        asyncio.run(ss.sio.save_session('sid1', session1))

        conn2_id = "conn_id_2"
        ss.state.add_online_user(self.u1.id, 'sid2', self.u1.username, 'USER', connection_id=conn2_id)
        session2 = {'user_id': str(self.u1.id), 'username': self.u1.username, 'connection_id': conn2_id}
        asyncio.run(ss.sio.save_session('sid2', session2))

        # Stale disconnect from Connection 1 triggers
        asyncio.run(ss.disconnect('sid1'))

        # Verify User 1 is STILL online in MatchmakingState under connection 2
        active_user = ss.state.get_online_user(self.u1.id)
        self.assertIsNotNone(active_user)
        self.assertEqual(active_user['connection_id'], conn2_id)
        self.assertEqual(active_user['sid'], 'sid2')

    def test_both_matched_users_pressing_next_simultaneously_does_not_duplicate_queue(self):
        state = ss.state
        state.set_match(self.u1.id, self.u2.id)
        state.add_online_user(self.u1.id, 'sid1', self.u1.username, 'USER')
        state.add_online_user(self.u2.id, 'sid2', self.u2.username, 'USER')

        session_u1 = {'user_id': str(self.u1.id), 'username': self.u1.username}
        session_u2 = {'user_id': str(self.u2.id), 'username': self.u2.username}
        asyncio.run(ss.sio.save_session('sid1', session_u1))
        asyncio.run(ss.sio.save_session('sid2', session_u2))

        # Trigger simultaneous next
        async def run_simultaneous():
            await asyncio.gather(
                ss.chat_next('sid1'),
                ss.chat_next('sid2')
            )
        asyncio.run(run_simultaneous())

        # Verify they are only added to queue once
        self.assertEqual(state.get_queue().count(str(self.u1.id)), 1)
        self.assertEqual(state.get_queue().count(str(self.u2.id)), 1)

    def test_disconnect_and_next_occurring_together_safely_terminate_match(self):
        state = ss.state
        state.set_match(self.u1.id, self.u2.id)
        state.add_online_user(self.u1.id, 'sid1', self.u1.username, 'USER', connection_id='conn1')
        state.add_online_user(self.u2.id, 'sid2', self.u2.username, 'USER', connection_id='conn2')

        session_u1 = {'user_id': str(self.u1.id), 'username': self.u1.username, 'connection_id': 'conn1'}
        session_u2 = {'user_id': str(self.u2.id), 'username': self.u2.username, 'connection_id': 'conn2'}
        asyncio.run(ss.sio.save_session('sid1', session_u1))
        asyncio.run(ss.sio.save_session('sid2', session_u2))

        # User 1 disconnects and User 2 clicks next concurrently
        async def run_race():
            await asyncio.gather(
                ss.disconnect('sid1'),
                ss.chat_next('sid2')
            )
        asyncio.run(run_race())

        # Verify match is cleared without exceptions and both enqueued safely
        self.assertIsNone(state.get_partner(self.u1.id))
        self.assertIsNone(state.get_partner(self.u2.id))

    def test_two_concurrent_matchmaking_attempts_cannot_match_one_user_twice(self):
        state = ss.state
        state.add_online_user(self.u1.id, 'sid1', self.u1.username, 'USER')
        state.add_online_user(self.u2.id, 'sid2', self.u2.username, 'USER')
        state.add_online_user(self.u3.id, 'sid3', self.u3.username, 'USER')

        state.join_queue(self.u1.id)
        state.join_queue(self.u2.id)
        state.join_queue(self.u3.id)

        # Trigger concurrent matchmaking tasks
        async def trigger_matchmaking():
            await asyncio.gather(
                ss.run_matchmaking(self.u1.id),
                ss.run_matchmaking(self.u2.id)
            )
        asyncio.run(trigger_matchmaking())

        # Verify only one match exists, no user has duplicate matches
        p1 = state.get_partner(self.u1.id)
        p2 = state.get_partner(self.u2.id)
        p3 = state.get_partner(self.u3.id)

        matches_count = sum(1 for p in [p1, p2, p3] if p is not None)
        self.assertEqual(matches_count, 2) # e.g. two users matched, one remaining in queue

    @override_settings(DEBUG=False)
    def test_production_mode_refuses_in_memory_fallback_on_redis_error(self):
        import sys
        import os
        
        exited = False
        def mock_exit(msg):
            nonlocal exited
            exited = True
            raise Exception("System exited")

        orig_exit = sys.exit
        sys.exit = mock_exit
        
        orig_argv = sys.argv
        sys.argv = ['manage.py', 'runserver'] # remove 'test' to skip test environment checks

        try:
            os.environ['REDIS_HOST'] = 'invalid_host_12345'
            os.environ['REDIS_PORT'] = '9999'
            
            with self.assertRaises(Exception):
                MatchmakingState()
                
            self.assertTrue(exited)
        finally:
            sys.exit = orig_exit
            sys.argv = orig_argv
            os.environ.pop('REDIS_HOST', None)
            os.environ.pop('REDIS_PORT', None)

    def test_admin_grant_updates_balance_and_ledger(self):
        from users.views import AdminGrantCreditsView
        from rest_framework.test import APIRequestFactory, force_authenticate
        admin = User.objects.create_superuser(username="admin_user", email="admin@vybe.chat", password="password", role='ADMIN')
        factory = APIRequestFactory()
        request = factory.post('/api/admin/credits/', {'user_id': self.u1.id, 'amount': 50}, format='json')
        force_authenticate(request, user=admin)
        view = AdminGrantCreditsView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.u1.refresh_from_db()
        self.assertEqual(self.u1.credits, 150)
        tx = CreditTransaction.objects.get(user=self.u1, transaction_type=TransactionType.ADMIN_GRANT)
        self.assertEqual(tx.amount, 50)
        self.assertEqual(tx.balance_after, 150)

    def test_admin_deduct_updates_balance_and_ledger(self):
        from users.views import AdminGrantCreditsView
        from rest_framework.test import APIRequestFactory, force_authenticate
        admin = User.objects.create_superuser(username="admin_user2", email="admin2@vybe.chat", password="password", role='ADMIN')
        factory = APIRequestFactory()
        request = factory.post('/api/admin/credits/', {'user_id': self.u1.id, 'amount': -30}, format='json')
        force_authenticate(request, user=admin)
        view = AdminGrantCreditsView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.u1.refresh_from_db()
        self.assertEqual(self.u1.credits, 70)
        tx = CreditTransaction.objects.get(user=self.u1, transaction_type=TransactionType.ADMIN_DEDUCT)
        self.assertEqual(tx.amount, -30)
        self.assertEqual(tx.balance_after, 70)

    def test_admin_matching_is_free(self):
        admin = User.objects.create_superuser(username="admin_user3", email="admin3@vybe.chat", password="password", role='ADMIN', credits=0)
        admin.gender_filter = 'MALE'
        admin.save()
        self.u2.gender_filter = 'ALL'
        self.u2.save()
        match_id = "admin_free_match"
        success, detail = asyncio.run(ss.try_create_match_and_charge(admin.id, self.u2.id, match_id))
        self.assertTrue(success)
        admin.refresh_from_db()
        self.assertEqual(admin.credits, 0)
