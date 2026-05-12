# GRTAP Relay Update - Segment 3 Review Draft

## Private Relay Vetting UX and Policy

Private relay vetting should feel like choosing the safety level for a space,
not configuring a surveillance system.

Operators choose capability requirements, invite policy, retention policy, and
destruction policy. They do not receive member identities, behavioral profiles,
raw trust scores, or cross-relay risk labels.

## Safety presets

Private relays SHOULD expose a small number of understandable safety presets.
Each preset maps to capability thresholds, not identity checks.

```
Open Map Space
  Use for: public pins, open map contribution, low-risk coordination
  Requires: basic capability attestation or none
  Social surface: no unrestricted DMs by default
  Retention: short public-map audit window

Crew Space
  Use for: stewardship jobs, cleanup runs, food drops, mutual aid tasks
  Requires: contributor capability
  Social surface: crew chat, role claims, limited invites
  Retention: task records and aggregate completion history

Trusted Crew Space
  Use for: repeated crews, higher-trust work, equipment access
  Requires: established capability
  Social surface: crew chat, limited direct-message requests, vouching optional
  Retention: relay-local records with expiration

Organizing Party
  Use for: sensitive planning, private events, high-stakes coordination
  Requires: trusted capability plus invite or vouch
  Social surface: private relay chat, role claims, no public discovery
  Retention: destroyable context

Sensitive Assembly
  Use for: peaceful assembly, protest support, legal-risk organizing
  Requires: trusted capability plus invite or vouch
  Social surface: minimal necessary coordination
  Retention: no durable roster, aggregate attendance only, destruction required
```

Relay software MAY allow advanced configuration, but the default operator
experience SHOULD be preset-based.

## Capability matrix

Each private relay defines which capabilities are required for each action.

```
Action                         Typical capability
------------------------------------------------------------
View public map pins           public or none
Confirm a pin                  map_confirm
Join a stewardship crew        crew_join
Use crew chat                  crew_chat
Send a DM request              dm_request
Invite another member          invite_member
Create an event                create_event
Join organizing party          join_organizing_party
Access private relay           private_relay_access
Claim attendance credit        attendance_credit_claim
Claim stewardship reward       stewardship_reward_claim
Vouch for another participant  vouch
```

The private relay asks for capability proofs only when a user attempts an action
that requires them. The user should not be asked to present broad access proofs
when a narrow proof is enough.

## User-facing language

The app SHOULD avoid exposing behavioral scoring language to ordinary users.

Use:

- "Build trust through verified contributions."
- "This space requires trusted crew access."
- "You need an invite or vouch to join this organizing space."
- "This action is temporarily unavailable."
- "Attendance credit is optional."

Avoid:

- "Your risk score is too high."
- "You were flagged as unsafe."
- "Your behavioral profile failed."
- "You are banned from organizing parties."
- "Your device fingerprint matched a bad actor."

The app can explain limits without exposing accusations, reports, thresholds, or
profile features.

## Joining flow

```
1. User opens private relay invitation or relay link.

2. Relay displays:
   - relay name or local label
   - safety preset
   - required proof class
   - retention and destruction summary
   - whether attendance credit is optional

3. User chooses whether to request a scoped capability proof.

4. Device requests the needed proof from the issuing relay.

5. Device presents proof to private relay.

6. Private relay verifies proof and creates a local session pseudonym.

7. Private relay discards proof material after verification, retaining only
   minimal replay-protection nullifiers.
```

The joining flow SHOULD make clear what the relay will remember and what it will
not remember.

## Operator-facing policy controls

Private relay operators SHOULD be able to configure:

- safety preset
- required capability class
- invite-only mode
- vouching mode
- maximum member count
- event sensitivity class
- attendance proof class
- attendance credit optionality
- retention window
- destruction key policy
- replay nullifier retention
- upward safety report availability

Private relay operators MUST NOT be able to configure:

- export of behavioral profiles
- export of attendance rosters for sensitive assemblies
- required real-name identity
- required phone number identity
- required government ID
- persistent cross-relay member tracking
- access to raw issuing-relay safety signals
- public negative labels for members

## Vouching policy

Vouching can improve safety and trust without requiring identity, but it can
also become social coercion. Vouching SHOULD be capability-scoped and
purpose-limited.

```
vouch = {
  vouched_capability,
  relay_scope,
  expires_at,
  strength_class,
  nullifier
}
```

A vouch SHOULD NOT reveal the voucher's real identity. A private relay MAY know
that a local trusted participant vouched, but SHOULD avoid creating durable
cross-relay vouching graphs.

For sensitive relays:

- vouches SHOULD expire
- vouches SHOULD be relay-local
- vouches SHOULD NOT be publicly visible
- vouching chains SHOULD be depth-limited
- revoked vouches SHOULD reduce capability locally, not create portable shame

## Youth and vulnerable-person spaces

Spaces involving minors, care work, shelter, or other vulnerable-person contexts
require stricter social safety defaults.

These spaces SHOULD use:

- no unsolicited DMs
- invite or staffed approval
- higher capability thresholds
- short retention for social metadata
- local moderator review for reports
- strict limits on off-platform contact requests
- no public member discovery

These spaces MUST still avoid real-name collection unless a separate legal or
organizational process explicitly requires it outside GRTAP. If such a process
exists, it should be treated as external to the zero-identity protocol.

## Safety interventions

Private relays SHOULD apply graduated interventions:

```
soft friction:
  cooldowns
  invite limits
  DM request limits
  temporary posting delays

medium restriction:
  no DMs
  no invites
  no event creation
  no vouching
  review before crew join

hard restriction:
  relay-local removal
  local session quarantine
  future capability proof required
  upward safety report for serious concern
```

A private relay SHOULD NOT expose intervention reasons to unrelated users.
Restrictions should be understandable to the affected user without revealing
reporters, private allegations, or model internals.

## Event sensitivity classes

Events SHOULD be assigned a sensitivity class that controls retention and
attendance behavior.

```
public_stewardship
  examples: cleanup run, public food drop, map verification day
  attendance: optional credit, aggregate count allowed
  retention: task outcome may persist

private_coordination
  examples: crew planning, equipment staging, mutual aid routing
  attendance: count or credit proof only
  retention: relay-local expiration

sensitive_assembly
  examples: peaceful assembly planning, protest support, legal-risk organizing
  attendance: aggregate count only by default
  retention: no roster, destruction required
```

The event sensitivity class SHOULD be visible to organizers before they collect
attendance or enable social features.

## Retention transparency

Before joining a private relay, a user SHOULD be able to see:

- whether the relay is destroyable
- whether attendance credit is optional
- whether aggregate attendance is stored
- whether messages expire
- whether nullifiers are retained temporarily
- whether upward safety reports are enabled

This should be written in plain language. Example:

```
This space does not keep a member roster. Attendance credit is optional.
Messages expire after 7 days. Replay-protection records are deleted when the
relay is destroyed.
```

## Fun app integration

The public app may present trust-building as playful progress:

- map confirmations
- completed runs
- crew streaks
- neighborhood coverage
- role claims
- stewardship rewards
- unlocked crew abilities

This progress MUST map to capability eligibility, not public identity status.
The app SHOULD avoid leaderboards that pressure users to expose themselves or
turn safety into social ranking.

## Normative statement

Private relay vetting is configured as capability policy, not identity policy.
Operators choose what a participant must be able to prove for a given action;
they do not receive behavioral profiles, identity records, durable attendance
rosters, or portable negative labels.
