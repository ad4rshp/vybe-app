from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from users.models import User, CreditTransaction, TransactionType
import logging
import uuid

logger = logging.getLogger(__name__)

# Token Package definitions matching frontend Packages
TOKEN_PACKAGES = {
    1: {"amount": 50, "price_usd": 0.99, "price_inr": 80},
    2: {"amount": 200, "price_usd": 2.99, "price_inr": 250},
    3: {"amount": 500, "price_usd": 4.99, "price_inr": 400},
}

class CheckoutSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        package_id = request.data.get('package_id')
        provider = request.data.get('provider')  # 'STRIPE' or 'RAZORPAY'

        if not package_id or int(package_id) not in TOKEN_PACKAGES:
            return Response({"error": "Invalid package selection."}, status=status.HTTP_400_BAD_REQUEST)
        if provider not in ['STRIPE', 'RAZORPAY']:
            return Response({"error": "Invalid payment provider selection."}, status=status.HTTP_400_BAD_REQUEST)

        pkg = TOKEN_PACKAGES[int(package_id)]
        user = request.user

        # Simulating payment creation session stubs
        # Note: Since the payment system is decoupled for future implementation,
        # we auto-approve the simulated payment in testing mode and credit the user immediately.
        try:
            with transaction.atomic():
                user_to_charge = User.objects.select_for_update().get(id=user.id)
                added_credits = pkg["amount"]
                user_to_charge.credits += added_credits
                user_to_charge.save(update_fields=['credits'])

                # Log purchase transaction
                tx_ref = f"sim_{provider.lower()}_{uuid.uuid4().hex[:12]}"
                CreditTransaction.objects.create(
                    user=user_to_charge,
                    amount=added_credits,
                    balance_after=user_to_charge.credits,
                    transaction_type=TransactionType.PURCHASE,
                    reference_id=tx_ref,
                    metadata={
                        "provider": provider,
                        "package_id": package_id,
                        "price": pkg["price_usd"] if provider == 'STRIPE' else pkg["price_inr"],
                        "currency": "USD" if provider == 'STRIPE' else "INR",
                        "status": "SIMULATED_SUCCESS"
                    }
                )

            logger.info(f"Simulated payment credited to {user.username}: +{added_credits} credits via {provider}")
            return Response({
                "success": True,
                "message": f"Successfully credited {added_credits} tokens via simulated {provider}!",
                "credits": user_to_charge.credits,
                "reference_id": tx_ref
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error executing simulated checkout: {e}")
            return Response({"error": "Failed to complete checkout simulation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StripeWebhookView(APIView):
    # Stripe Webhook verification placeholder
    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        # In future deployment, you will verify the signature with:
        # try:
        #     event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_ENDPOINT_SECRET)
        # except ValueError as e:
        #     return Response(status=400)
        # except stripe.error.SignatureVerificationError as e:
        #     return Response(status=400)

        # Handle successful checkout session webhook
        # if event['type'] == 'checkout.session.completed':
        #     session = event['data']['object']
        #     # Retrieve metadata and credit user's account...

        logger.info("Stripe webhook received (stub).")
        return Response({"received": True}, status=status.HTTP_200_OK)

class RazorpayWebhookView(APIView):
    # Razorpay Webhook verification placeholder
    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_X_RAZORPAY_SIGNATURE')

        # In future deployment, you will verify the signature with:
        # hmac = HMAC(key=RAZORPAY_SECRET.encode(), msg=payload, digestmod=SHA255)
        # if hmac.hexdigest() != sig_header:
        #     return Response(status=400)

        # Handle successful payment webhook
        # if event_type == 'payment.captured':
        #     # Retrieve order info and credit user's account...

        logger.info("Razorpay webhook received (stub).")
        return Response({"received": True}, status=status.HTTP_200_OK)
