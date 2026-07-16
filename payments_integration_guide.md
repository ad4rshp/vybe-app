# Stripe & Razorpay Payments Integration Guide

This guide details how to implement the actual checkout sessions and handle live webhooks for both payment gateways.

---

## 1. Stripe Integration (Global)

### Backend Requirements
1. Install Stripe Python library:
   ```bash
   pip install stripe
   ```
2. Configure keys in `settings.py`:
   ```python
   STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
   STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
   ```

### views.py Checkout implementation
Replace `CheckoutSessionView` logic for Stripe:
```python
import stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Inside post():
session = stripe.checkout.Session.create(
    payment_method_types=['card'],
    line_items=[{
        'price_data': {
            'currency': 'usd',
            'product_data': {
                'name': f'{pkg["amount"]} VYBE Tokens',
            },
            'unit_amount': int(pkg["price_usd"] * 100), # in cents
        },
        'quantity': 1,
    }],
    mode='payment',
    success_url=request.build_absolute_uri('/shop?success=true'),
    cancel_url=request.build_absolute_uri('/shop?canceled=true'),
    metadata={
        'user_id': user.id,
        'package_id': package_id,
        'amount': pkg["amount"]
    }
)
return Response({"checkout_url": session.url})
```

---

## 2. Razorpay Integration (India)

### Backend Requirements
1. Install Razorpay SDK:
   ```bash
   pip install razorpay
   ```
2. Configure keys in `settings.py`:
   ```python
   RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID')
   RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET')
   ```

### views.py Checkout implementation
Replace `CheckoutSessionView` logic for Razorpay:
```python
import razorpay
client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

# Inside post():
order_data = {
    'amount': int(pkg["price_inr"] * 100), # in paise
    'currency': 'INR',
    'receipt': f'receipt_pkg_{package_id}_{user.id}',
    'notes': {
        'user_id': str(user.id),
        'package_id': str(package_id),
        'amount': str(pkg["amount"])
    }
}
razorpay_order = client.order.create(data=order_data)
return Response({
    "razorpay_order_id": razorpay_order['id'],
    "amount": order_data['amount'],
    "key_id": settings.RAZORPAY_KEY_ID,
    "user_email": user.email,
    "user_username": user.username
})
```

---

## 3. Webhook Event Processing (Fulfillment)

When Stripe/Razorpay processes the payment, they send an HTTP POST request to your webhook endpoint.

### Stripe Webhook
Use Stripe's signature checker to fulfill orders:
```python
# Inside StripeWebhookView.post():
payload = request.body
sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

try:
    event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
except Exception:
    return Response(status=400)

if event['type'] == 'checkout.session.completed':
    session = event['data']['object']
    user_id = session['metadata']['user_id']
    amount = int(session['metadata']['amount'])
    # Update user.credits in database and create CreditTransaction
```

### Razorpay Webhook
Use Razorpay's signature checker to fulfill orders:
```python
# Inside RazorpayWebhookView.post():
payload = request.body
sig_header = request.META.get('HTTP_X_RAZORPAY_SIGNATURE')

# Verify webhook signature using razorpay client utility:
# client.utility.verify_webhook_signature(payload, sig_header, settings.RAZORPAY_WEBHOOK_SECRET)
```
