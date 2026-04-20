# Privacy Policy for HelloVibe

**Last Updated: April 2026**

## Overview

HelloVibe is designed to help you start and continue AI coding work across devices and environments while keeping sensitive content private. This policy explains what data we process, what stays encrypted, and where third-party services are involved.

## What We Collect

### Encrypted Data
- **Messages and Code**: Your AI coding conversations, code snippets, and similar content are encrypted on your device before transmission. We may store encrypted payloads for synchronization, but we do not have the keys needed to read them.
- **Encryption Keys**: When you pair devices, keys are exchanged in encrypted form between your devices. We do not have access to the plaintext keys.

### Metadata (Not Encrypted)
- **Message IDs**: Unique identifiers for message ordering and synchronization
- **Timestamps**: When messages were created and synced
- **Device IDs**: Anonymous identifiers for device pairing
- **Session IDs**: Identifiers for your AI coding terminal sessions
- **Push Notification Tokens**: Device tokens used to route push notifications through Expo's push notification service

### Analytics (PostHog)
- **Anonymous Events**: We collect limited product usage events through PostHog to understand app reliability and improve the experience
- **Pseudonymous IDs**: Analytics events use a derived identifier rather than your encrypted content
- **No Content Tracking**: We do not send message content, code, or encrypted payloads to analytics
- **Opt-Out Available**: You can disable analytics collection at any time in the app settings

### Subscription Management (Revenue Cat)
- **Account ID**: RevenueCat may process an app-specific account identifier to manage purchases or premium entitlements when those features are enabled
- **Purchase Status**: RevenueCat may receive platform transaction metadata needed to validate purchases
- **No Payment Card Storage by Us**: We do not receive or store your payment card information

## What We Don't Collect
- Plaintext code or plaintext conversation content from encrypted session traffic
- Personal information beyond what you explicitly provide through the app or connected services
- Precise location data
- Your payment card details

## How We Use Data

### Encrypted Data
- Stored on our servers solely for synchronization between your devices
- Transmitted to your paired devices when requested
- Retained only as needed for synchronization and continuity features

### Metadata
- Message IDs and timestamps are used to maintain proper message ordering
- Device IDs enable secure pairing between your devices
- Session IDs track your AI coding terminal sessions for synchronization
- Push notification tokens are stored to enable notifications through Expo's service

### Push Notifications
Push notifications are used to help you keep work moving across devices. We use Expo's push notification infrastructure as a delivery mechanism, but notification content is designed to avoid exposing unnecessary sensitive information.

## Data Security

- **End-to-End Encryption**: Sensitive session content is encrypted before transmission
- **Zero-Knowledge Design**: We are not intended to have access to your plaintext session content
- **Secure Key Exchange**: Encryption keys are exchanged between your devices in encrypted form
- **Open Source**: Core implementation details are available in the source repository

## Data Retention

- Encrypted content and related metadata may be retained while needed for synchronization, recovery, and service operation
- Some operational records may be kept longer where required for security, fraud prevention, or legal compliance
- Retention periods may change as HelloVibe evolves, and material updates will be reflected in this policy

## Your Choices

- You can disable analytics collection in the app settings
- You can review the open-source codebase to understand how encrypted data flows through the app
- You can contact support with privacy-related questions or requests
- You can stop using the service at any time

## Third-Party Processors

We use a limited set of service providers to operate HelloVibe. Depending on the feature you use, this can include:

- **Expo** for push notification delivery and app infrastructure
- **PostHog** for product analytics
- **RevenueCat** for purchase and entitlement management

These providers process only the data needed for their role, under their own service terms and privacy commitments.

## Changes to This Policy

We may update this policy as HelloVibe evolves. If we make material changes, we will update the policy date and may provide additional notice through the app or our public channels.

## Contact

For privacy concerns or questions:
- Support: https://app.hellovibe-ai.com/support

## Compliance

HelloVibe is designed with privacy-by-default principles in mind. We review our data practices against applicable privacy requirements as the product evolves.

---

**Remember**: HelloVibe is built so that sensitive session content is encrypted before transmission, helping keep your code and conversations private across devices.
