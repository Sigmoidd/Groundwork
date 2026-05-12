# GRTAP Relay Update - Segment 2 Review Draft

## Capability Attestation and Attendance Proofs

Private relays verify capabilities, not identities. A private relay may require
proof that a device is eligible for a specific action, but it MUST NOT receive
the behavioral profile, trust score, safety score, or attendance history used to
make that decision.

Capability attestations are relay-scoped, action-scoped, short-lived,
single-use, and unlinkable.

## Capability classes

A capability attestation proves eligibility for one bounded action. Example
capability classes:

- `map_confirm`
- `crew_join`
- `crew_chat`
- `dm_request`
- `invite_member`
- `create_event`
- `join_organizing_party`
- `private_relay_access`
- `vouch`
- `stewardship_reward_claim`
- `attendance_credit_claim`

The issuing relay MAY evaluate internal trust and safety signals before issuing
a capability attestation. The verifying relay only learns whether the presented
attestation is valid for the requested capability.

## Capability attestation object

```
capability_attestation = {
  capability: string,
  threshold_class: string,
  relay_scope: VR_domain_hash,
  action_scope: optional_action_hash,
  issued_at: timestamp,
  expires_at: timestamp,
  token_nonce: random_nonce,
  nullifier: one_use_nullifier,
  issuer_signature: blind_signature,
  presentation_proof: device_key_proof
}
```

`threshold_class` SHOULD use coarse classes rather than exact trust values.
Examples:

```
public
contributor
established
trusted
keeper
```

The attestation MUST NOT contain:

- raw trust score
- raw safety score
- behavioral profile bits
- report reason codes
- device fingerprint
- account history
- private relay membership
- attendance history

## Issuance flow

```
1. Device chooses the desired capability and verifying relay scope.

2. Device blinds a fresh capability token request.

3. Device sends to issuing relay:
   {
     device_id_or_local_actor_ref,
     blinded_capability_request,
     requested_capability,
     requested_threshold_class,
     relay_scope_hash,
     request_nonce
   }

4. Issuing relay evaluates local trust and safety state.

5. If eligible, issuing relay signs the blinded request.

6. Device unblinds the signature.

7. Device presents the capability attestation to the private relay.

8. Private relay verifies:
   - issuer signature
   - relay scope
   - capability scope
   - expiry
   - one-use nullifier
   - presentation proof
```

The issuing relay MAY log that a local device requested a capability class. It
MUST NOT log the private relay purpose, membership, event, or future use of the
token. The private relay MUST NOT store the attestation token after verification
except for the minimal spent-nullifier record needed to prevent replay.

## Zero-knowledge capability proof

Where practical, capability eligibility SHOULD be expressed as a zero-knowledge
predicate:

```
trust_score >= required_trust_threshold
AND safety_risk <= allowed_risk_threshold
AND capability_not_revoked
AND token_not_expired
```

The proof reveals only that the predicate is true. It does not reveal the trust
score, risk score, component signals, report history, or reason for eligibility.

For implementation v0.2, this MAY be represented by a blind signature over a
relay-scoped capability token. Future versions MAY replace or supplement this
with a full ZK range proof for trust and safety thresholds.

## Attendance without assembly exposure

Attendance is useful for stewardship rewards, trust accumulation, planning
capacity, and post-event accountability. It is also dangerous if it becomes an
assembly roster.

Groundwork MUST distinguish between:

- proving that an anonymous participant attended
- proving how many participants attended
- proving that a task or event occurred
- preserving a list of who attended

The first three MAY be allowed. The fourth MUST NOT be created for sensitive
organizing contexts.

## Attendance proof classes

Groundwork supports three attendance proof classes:

### Count proof

A count proof lets a relay learn that approximately or exactly `N` eligible
participants checked in, without learning which devices they were.

Use cases:

- capacity planning
- quorum confirmation
- safety headcount
- post-event reporting

The private relay MAY store aggregate counts, but MUST NOT store per-device
attendance records for sensitive organizing events.

### Credit proof

A credit proof lets a device later claim stewardship or trust credit for
attendance without revealing the event to unrelated relays.

Use cases:

- stewardship reward claim
- contributor trust increment
- completion streak

The proof SHOULD be event-scoped and unlinkable. The issuing relay learns that
the device has a valid attendance credit claim, but SHOULD NOT learn the event
purpose, member list, or private relay context.

### Occurrence proof

An occurrence proof lets a relay or group prove that an event happened, that a
task was completed, or that a threshold number of participants were present.

Use cases:

- completed cleanup run
- delivery completed
- mutual aid drop occurred
- public stewardship task verified

Occurrence proofs SHOULD reveal task completion and aggregate participation, not
a roster.

## Attendance ZK flow

```
1. Private relay creates an event commitment:
   event_commitment = H(relay_event_secret, event_time_bucket, event_type_class)

2. Eligible participant checks in locally and receives a blinded attendance
   credential from the private relay:
   blinded_attendance_credential = Sign_VR_blinded(
     H(event_commitment, participant_nonce, attendance_class)
   )

3. Participant unblinds and stores the attendance credential locally.

4. Private relay increments only aggregate counters:
   - checked_in_count
   - role_count buckets, if needed
   - safety_headcount buckets, if needed

5. Private relay discards check-in linkage after the event retention window.

6. For credit, participant presents a zero-knowledge proof that:
   - they hold a valid attendance credential signed by the private relay
   - the credential belongs to an allowed attendance class
   - the credential has not been spent before
   - the credential is within the allowed time window

7. Issuing relay verifies the proof and grants the appropriate trust or reward
   credit without receiving the private relay roster.
```

## Attendance nullifiers

Attendance credentials MUST use one-use nullifiers to prevent double claiming
without linking attendance across events.

```
attendance_nullifier = H(attendance_secret, claim_scope)
```

`claim_scope` SHOULD be narrow. A nullifier used to claim stewardship credit
MUST NOT also act as a stable identifier for private relay access, social chat,
or future organizing events.

## Sensitive assembly rule

For events marked sensitive, private, or assembly-related:

- no durable roster may be created
- no device pubkeys may be stored after check-in
- no attendance token may be stored after verification
- no exact location trail may be retained unless explicitly required for safety
- aggregate counts should use time buckets where possible
- attendance credit should be optional and participant-controlled
- relay destruction must delete event commitments, counters, and spent
  nullifiers except where short-lived replay protection is still required

The protocol MUST NOT create records that assist reconstruction of a peaceful
assembly's membership, movement, leadership, or attendance list.

## Private relay verification record

A private relay MAY retain a spent-nullifier set to prevent replay. For
sensitive events, this record SHOULD be:

- scoped to the event or capability
- short-lived
- unlinkable to other relay activity
- deleted during relay destruction

The spent-nullifier set MUST NOT contain device pubkeys, main relay device IDs,
behavioral profile bits, or local pseudonym mappings.

## Normative statement

Capability attestations and attendance proofs establish eligibility,
participation, or aggregate occurrence without exporting identity, behavioral
profiles, attendance rosters, or private relay context. Attendance records MUST
be designed so they cannot be used to reconstruct participation in a peaceful
assembly.
