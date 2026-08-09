import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { sendSubscriptionInvoice } from '@/lib/invoice-actions';
import { sendEventTicket } from '@/lib/ticket-actions';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const session = event.data.object as any;

  if (event.type === 'checkout.session.completed') {
    const metadata = session.metadata;
    console.log('📦 Webhook Metadata:', metadata);

    if (metadata.type === 'membership') {
      try {
        await prisma.subscription.create({
          data: {
            userId: metadata.userId,
            planId: metadata.planId,
            paymentMethod: 'STRIPE',
            paymentStatus: 'PAID',
            status: 'ACTIVE',
            stripeId: session.id,
            stripeSubscriptionId: session.subscription, // ID of the subscription
            isApproved: true,
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            details: metadata.details ? JSON.parse(metadata.details) : {},
          }
        });
        console.log('✅ Membership subscription created successfully');
        
        // Send Invoice
        const newSub = await prisma.subscription.findFirst({
           where: { stripeId: session.id }
        });
        if (newSub) {
           await sendSubscriptionInvoice(newSub.id);
        }
      } catch (dbError) {
        console.error('❌ Database error creating subscription:', dbError);
      }
    }

    if (metadata.type === 'membership_payment' && metadata.subscriptionId) {
       try {
          await prisma.subscription.update({
             where: { id: metadata.subscriptionId },
             data: {
                paymentStatus: 'PAID',
                status: 'ACTIVE',
                stripeSubscriptionId: session.subscription,
                isApproved: true,
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
             }
          });
          console.log('✅ Membership payment updated successfully');

          // Send Invoice
          await sendSubscriptionInvoice(metadata.subscriptionId);
       } catch (dbError) {
          console.error('❌ Database error updating subscription payment:', dbError);
       }
    }

    if (metadata.type === 'event_registration') {
      try {
        const reg = await prisma.registration.create({
          data: {
            ticketId: `KSA-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            eventId: metadata.eventId,
            name: metadata.name,
            email: metadata.email,
            phone: metadata.phone,
            attendees: parseInt(metadata.attendees),
            pricePaid: session.amount_total / 100,
            paymentMethod: 'STRIPE',
            paymentStatus: 'PAID',
            stripeId: session.id,
          }
        });
        console.log('✅ Event registration created successfully');
        
        // Auto-send ticket
        await sendEventTicket(reg.id);
      } catch (dbError) {
        console.error('❌ Database error creating registration:', dbError);
      }
    }
  }

  // Handle Subscription lifecycle events
  if (event.type === 'customer.subscription.deleted') {
     const subscription = event.data.object as any;
     try {
        await prisma.subscription.update({
           where: { stripeSubscriptionId: subscription.id },
           data: {
              status: 'EXPIRED',
              paymentStatus: 'EXPIRED'
           }
        });
        console.log('✅ Subscription marked as expired in DB');
     } catch (dbError) {
        console.error('❌ Error handling subscription deletion:', dbError);
     }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as any;
    if (invoice.subscription) {
      try {
        await prisma.subscription.update({
          where: { stripeSubscriptionId: invoice.subscription as string },
          data: {
            paymentStatus: 'FAILED',
            status: 'PAST_DUE'
          }
        });
        console.log('⚠️ Subscription payment failed, marked as PAST_DUE');
      } catch (err) {
        console.error('❌ Error handling failed payment:', err);
      }
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as any;
    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      try {
        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'PAST_DUE',
            paymentStatus: 'FAILED'
          }
        });
      } catch (err) {
        console.error('❌ Error handling subscription update:', err);
      }
    } else if (subscription.status === 'active') {
      try {
        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'ACTIVE',
            paymentStatus: 'PAID'
          }
        });
      } catch (err) {
        console.error('❌ Error handling subscription update:', err);
      }
    }
  }

  return new NextResponse(null, { status: 200 });
}
