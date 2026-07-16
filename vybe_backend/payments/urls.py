from django.urls import path
from .views import CheckoutSessionView, StripeWebhookView, RazorpayWebhookView

urlpatterns = [
    path('checkout/', CheckoutSessionView.as_view(), name='payment-checkout'),
    path('webhook/stripe/', StripeWebhookView.as_view(), name='payment-webhook-stripe'),
    path('webhook/razorpay/', RazorpayWebhookView.as_view(), name='payment-webhook-razorpay'),
]
