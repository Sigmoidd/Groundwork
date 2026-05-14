# Groundwork Relay Trust Attestation Protocol
## Version 0.2 Draft Specification
### Christian Adkins - Groundwork OKC - May 2026
### Open Protocol - CC0 Public Domain

---

## 1. Overview

The Groundwork Relay Trust Attestation Protocol (GRTAP) enables portable,
privacy-preserving trust and safety verification across independent Groundwork
relay instances. A device that has built a behavioral trust record on an issuing
relay can present cryptographic proofs of eligibility to another relay without
revealing identity, history, behavioral profile, attendance history, or where
prior attestations were used.

**Core guarantee:** The issuing relay may know that a device earned trust. It
does not know where that trust is spent. A private relay may know that a device
has sufficient capability for a requested action. It does not know who the user
is, what behavioral profile produced the proof, or what other relays the user
has joined.

**Design principles:**

- Zero identity. No names, phone numbers, government IDs, or real-world identity
  claims are required by the protocol.
- Capability-based access. Relays restrict what a participant can do; they do
  not label what a participant is.
- One-directional attestation. The issuing relay cannot track attestation use.
- Unlinkable proofs. Multiple attestations from the same device cannot be
  correlated by verifying relays.
- Relay sovereignty. Every relay operator controls their own thresholds, invite
  policy, retention policy, and destruction policy.
- Destroyable context. A private relay and its records can be permanently
  destroyed without leaving a recoverable organizing record on the issuing
  relay.
- No portable shame. Negative safety labels, reason codes, risk scores, and
  behavioral profiles do not travel between relays.

---

## 2. Threat Model

**Threats GRTAP is designed to reduce:**

1. Fresh account infiltration. A bad actor creates a new account to access a
   private organizing relay. GRTAP requires demonstrated behavior before higher
   capability attestations are issued.

2. Agent subversion. An infiltrator attempts to join a private relay to surveil
   or disrupt organizing activity. Trust and safety capabilities raise the cost
   of access while avoiding identity collection.

3. Relay correlation. An adversary attempts to link activity across relays.
   GRTAP uses scoped, single-use, unlinkable tokens so the same device presenting
   proofs to two relays cannot be correlated by either relay.

4. Subpoena exposure. Law enforcement compels the issuing relay to identify
   participants in a private relay event. The issuing relay is architecturally
   blind to private relay membership, event purpose, attendance rosters, and
   token use after issuance.

5. Relay betrayal. A private relay operator turns over member records. GRTAP
   stores no real-world identity in the protocol layer, minimizes durable
   membership records, and supports destruction of relay context.

6. Predator access to social surfaces. A bad actor attempts to use chat,
   invites, DMs, vouching, or organizing spaces to target users. GRTAP gates
   social capabilities without exporting behavioral profiles or identity labels.

**Threats GRTAP does not fully defeat:**

1. Physical surveillance. GRTAP protects protocol-layer identity. It does not
   protect physical presence at events.

2. Long-term behavioral deanonymization. Sustained observation of behavior can
   become identifying. GRTAP mitigates this through coarse signals, short
   retention windows, local-only recognition, and relay destruction.

3. Compromised relay software. A malicious or modified private relay can harvest
   data outside the protocol. Mitigations include open-source relay software,
   community review, reproducible builds, and relay reputation.

4. Coercive external identity processes. Organizations may require identity
   outside GRTAP for legal or operational reasons. Such processes are external
   to the zero-identity protocol and must not be represented as GRTAP guarantees.

---

## 3. Cryptographic Primitives

GRTAP uses standard, audited cryptographic primitives only.

**Key pairs:** Ed25519 or another audited signature scheme for signing and
verification.

**Commitments:** Pedersen commitments or equivalent commitment schemes for
binding values without revealing them.

**Zero-knowledge proofs:** Range proofs or equivalent ZK predicates for proving
that trust and safety thresholds are satisfied without revealing underlying
scores.

**Blinding:** Blind signatures for unlinkable token issuance. The issuing relay
signs a blinded token; the device unblinds it; the verifying relay can validate
the signature without enabling the issuer to recognize token use.

**Hash function:** BLAKE3 or another modern cryptographic hash function.

**Nullifiers:** One-use nullifiers prevent replay or double-claiming without
becoming stable identifiers across relays, events, or capabilities.

---

## 4. Entities

**Issuing Relay (IR)**  
A relay that accumulates local trust and safety signals and issues capability
attestations. Usually the main public Groundwork relay.

**Device (D)**  
The user's browser or app instance. It holds local keys and requests capability
attestations. It is not treated as a permanent identity because devices can be
lost, shared, replaced, or affected by accessibility tools.

**Verifying Relay (VR)**  
A private or local relay that verifies scoped capability attestations before
allowing specific actions.

**Capability Attestation (CA)**  
A cryptographic proof issued by IR, carried by D, and verified by VR. It proves
eligibility for one scoped action without revealing trust score, safety score,
profile bits, identity, or attendance history.

**Attendance Credential (AC)**  
A blinded credential proving anonymous participation, aggregate count, or event
occurrence without creating a durable roster.

---

## 5. Behavioral Safety Boundary

Behavioral safety profiles are never exported between relays. The issuing relay
may evaluate local behavioral risk signals, but private relays receive only
unlinkable, relay-scoped capability attestations proving that a device satisfies
the requested safety and trust threshold.

Groundwork may use behavioral safety signals to protect social and organizing
surfaces, but behavioral profiles must not become portable identity records.

The issuing relay may evaluate local behavioral signals to decide whether a
device is eligible for a social or organizing capability. The issuing relay must
not export the underlying behavioral profile, raw signal bits, device
fingerprint, interaction graph, or negative safety label to a private relay.

Private relays receive only cryptographic capability attestations. These
attestations prove that the presenting device satisfies the requested trust and
safety threshold for a specific relay-scoped action. They do not reveal why the
device qualified, why another device failed to qualify, or what behavioral
signals were evaluated.

### 5.1 Design Rules

Positive trust may be portable as a cryptographic proof.

Behavioral risk must remain local to the relay that observed it, except where it
affects whether a relay-scoped capability token is issued.

Recognition is not identity. A relay may recognize a returning unsafe device or
actor for its own local safety decisions, but it must not export that recognition
state to another relay.

### 5.2 Internal Safety Profiles

An issuing relay may maintain an internal behavioral safety profile for a device
or local pseudonymous actor. This profile may include coarse, minimized,
time-bucketed behavioral features such as:

- account or device maturity buckets
- session cadence buckets
- invite velocity
- direct-message request velocity
- reply asymmetry
- block or report friction
- crew join and leave churn
- event reliability
- rapid trust-seeking behavior
- repeated boundary violations
- attestation request rate

These features should be coarse, decaying, and purpose-limited. They should not
be treated as permanent identity and must not be exported between relays.

### 5.3 Restricted Signal Classes

The following signal classes are high-risk because they can become biometric,
accessibility-revealing, or uniquely identifying:

- screen brightness
- system volume
- tap pressure
- typing cadence
- accelerometer or motion patterns
- fine-grained timing signatures
- persistent device fingerprints
- precise daily location routines
- raw direct-message relationship graphs

If used at all, these signals must be local, coarse, salted or otherwise
unlinkable, short-lived, and excluded from portable attestations. They must not
be a source of truth for identity because users can switch devices, share
devices, lose devices, or use accessibility tools that alter these signals.

### 5.4 Local-Only Re-Identification

GRTAP v0.1 allowed a new account that matched a banned device to inherit the
prior account's trust modifier. Version 0.2 narrows that mechanism.

The issuing relay may use local recognition mechanisms to protect its own public
map, social surfaces, trust issuance, and abuse response. For example, if a
device or local actor repeatedly creates new accounts after capability
restrictions, the issuing relay may apply a degraded starting trust score or
deny specific future capability attestations.

This recognition state is local to the issuing relay. It must not be transmitted
to private relays as a fingerprint, ban label, cross-relay risk score, reason
code, or profile feature. A private relay only learns whether a relay-scoped
capability attestation is valid.

Local re-identification should be used conservatively:

- it should rely on multiple weak signals rather than one persistent fingerprint
- it should decay over time unless unsafe behavior continues
- it should support review or appeal for high-impact restrictions
- it should avoid biometric, accessibility-revealing, or precise device signals
- it must not be used to create a permanent cross-relay identity

---

## 6. Capability Attestation Protocol

Private relays verify capabilities, not identities. A private relay may require
proof that a device is eligible for a specific action, but it must not receive
the behavioral profile, trust score, safety score, or attendance history used to
make that decision.

Capability attestations are relay-scoped, action-scoped, short-lived,
single-use, and unlinkable.

### 6.1 Capability Classes

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

### 6.2 Capability Attestation Object

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

The relay v0.2 wire token is deliberately plain and strict:

```
capability_token = {
  schema: "grtap.blind.token.v1",
  kind: "capability",
  capability: string,
  thresholdClass: "public" | "contributor" | "established" | "trusted" | "keeper",
  relayScopeHash: sha256_hex,
  actionScopeHash: sha256_hex,
  issuedAt: unix_ms,
  expiresAt: unix_ms,
  tokenNonce: base64url_nonce,
  nullifier: base64url_nonce
}
```

The verifier must reject a presentation unless the revealed token fields match
the visible ask envelope. The ask envelope must name the required capability,
minimum threshold class, relay scope hash, and action scope hash. Missing ask
fields are verification failures, not defaults.

The issuing relay must default-deny high-trust capability issuance. A fresh or
unconfigured relay may issue only public-threshold capability tokens unless a
local trust policy explicitly raises the maximum issuable threshold. A capability
token must also meet the minimum threshold for that capability class.

`threshold_class` should use coarse classes rather than exact trust values:

```
public
contributor
established
trusted
keeper
```

The attestation must not contain:

- raw trust score
- raw safety score
- behavioral profile bits
- report reason codes
- device fingerprint
- account history
- private relay membership
- attendance history

### 6.3 Issuance Flow

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
   - strict equality between revealed token fields and the visible ask envelope
```

The issuing relay may log that a local device requested a capability class. It
must not log the private relay purpose, membership, event, or future use of the
token. The private relay must not store the attestation token after verification
except for the minimal spent-nullifier record needed to prevent replay.

### 6.4 Zero-Knowledge Capability Predicate

Where practical, capability eligibility should be expressed as a zero-knowledge
predicate:

```
trust_score >= required_trust_threshold
AND safety_risk <= allowed_risk_threshold
AND capability_not_revoked
AND token_not_expired
```

The proof reveals only that the predicate is true. It does not reveal the trust
score, risk score, component signals, report history, or reason for eligibility.

For implementation v0.2, this may be represented by a blind signature over a
relay-scoped capability token. Future versions may replace or supplement this
with a full ZK range proof for trust and safety thresholds.

---

## 7. Attendance Without Assembly Exposure

Attendance is useful for stewardship rewards, trust accumulation, planning
capacity, and post-event accountability. It is also dangerous if it becomes an
assembly roster.

Groundwork must distinguish between:

- proving that an anonymous participant attended
- proving how many participants attended
- proving that a task or event occurred
- preserving a list of who attended

The first three may be allowed. The fourth must not be created for sensitive
organizing contexts.

### 7.1 Attendance Proof Classes

**Count proof:** Lets a relay learn that approximately or exactly `N` eligible
participants checked in, without learning which devices they were. This supports
capacity planning, quorum confirmation, safety headcount, and post-event
reporting.

**Credit proof:** Lets a device later claim stewardship or trust credit for
attendance without revealing the event to unrelated relays. The proof should be
event-scoped and unlinkable. The issuing relay learns that the device has a
valid attendance credit claim, but should not learn the event purpose, member
list, or private relay context.

**Occurrence proof:** Lets a relay or group prove that an event happened, that a
task was completed, or that a threshold number of participants were present.
Occurrence proofs should reveal task completion and aggregate participation, not
a roster.

### 7.2 Attendance ZK Flow

```

The relay v0.2 blind attendance token uses the same strict presentation rule:

```
attendance_token = {
  schema: "grtap.blind.token.v1",
  kind: "attendance",
  attendanceClass: "count" | "credit" | "occurrence",
  eventCommitment: sha256_hex,
  issuedAt: unix_ms,
  expiresAt: unix_ms,
  tokenNonce: base64url_nonce,
  nullifier: base64url_nonce
}
```

`count` is the safe default. `credit` and `occurrence` must be explicitly enabled
by relay policy because they can create stronger incentives to preserve event
records. A verifier must reject an attendance presentation unless the revealed
attendance class and event commitment match the visible ask envelope.
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

### 7.3 Attendance Nullifiers

Attendance credentials must use one-use nullifiers to prevent double claiming
without linking attendance across events.

```
attendance_nullifier = H(attendance_secret, claim_scope)
```

`claim_scope` should be narrow. A nullifier used to claim stewardship credit
must not also act as a stable identifier for private relay access, social chat,
or future organizing events.

### 7.4 Sensitive Assembly Rule

For events marked sensitive, private, or assembly-related:

- no durable roster may be created
- no device pubkeys may be stored after check-in
- no attendance token may be stored after verification
- no exact location trail may be retained unless explicitly required for safety
- aggregate counts should use time buckets where possible
- attendance credit should be optional and participant-controlled
- relay destruction must delete event commitments, counters, and spent
  nullifiers except where short-lived replay protection is still required

The protocol must not create records that assist reconstruction of a peaceful
assembly's membership, movement, leadership, or attendance list.

---

## 8. Private Relay Architecture

### 8.1 Spinning Up A Private Relay

Any Groundwork user with sufficient capability may spin up a private relay. The
process:

```
1. Download relay software.
2. Deploy on a server, local machine, or community node.
3. Configure:
   - relay_name or local label
   - safety preset
   - required capability class
   - invite-only mode
   - vouching mode
   - event sensitivity class
   - attendance proof class
   - retention window
   - destruction key
4. Register relay_domain with IR public key only.
5. Relay is live.
```

The issuing relay stores only what is needed to verify relay keys. It does not
store operator identity, relay purpose, membership, event plans, attendance
records, or social graph.

### 8.2 Member Invitation

```
Option A: Capability threshold only
  Any device with a valid scoped capability attestation may join.
  Lower friction, higher risk.

Option B: Invite code + capability threshold
  Member must present both valid invite code and valid capability attestation.
  Recommended for sensitive organizing.

Option C: Vouch + capability threshold
  Existing local members can vouch for new members.
  Vouching is relay-local, expiring, and capability-scoped.
```

### 8.3 Data That Lives On A Private Relay

```
What may be stored:
  - local session IDs
  - relay-local pseudonyms
  - event pins and task records
  - chat messages under retention policy
  - aggregate attendance counts
  - local trust and safety signals
  - spent nullifiers needed for replay prevention

What must not be stored after verification:
  - GRTAP attestation tokens
  - device pubkeys where no longer needed
  - main relay device IDs
  - raw behavioral profiles from the issuing relay
  - private relay rosters for sensitive assemblies
  - links between local pseudonyms and main relay identifiers
```

### 8.4 Relay Destruction

When the destruction key is triggered, the relay deletes or destroys:

- local database records
- event commitments
- chat records
- attendance counters
- spent nullifiers
- local pseudonym mappings
- relay keys, where appropriate

The issuing relay records only that the relay domain is no longer active, if
domain registration is used. It has no record of what happened on the private
relay or who was a member.

---

## 9. Private Relay Vetting UX And Policy

Private relay vetting should feel like choosing the safety level for a space,
not configuring a surveillance system.

Operators choose capability requirements, invite policy, retention policy, and
destruction policy. They do not receive member identities, behavioral profiles,
raw trust scores, or cross-relay risk labels.

### 9.1 Safety Presets

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

Relay software may allow advanced configuration, but the default operator
experience should be preset-based.

### 9.2 Capability Matrix

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
that requires them.

### 9.3 User-Facing Language

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

### 9.4 Operator Controls

Private relay operators should be able to configure:

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

Private relay operators must not be able to configure:

- export of behavioral profiles
- export of attendance rosters for sensitive assemblies
- required real-name identity
- required phone number identity
- required government ID
- persistent cross-relay member tracking
- access to raw issuing-relay safety signals
- public negative labels for members

### 9.5 Event Sensitivity Classes

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

---

## 10. Upward Safety Reporting

A private relay that observes a serious safety concern may submit a narrow
upward safety signal to the issuing relay. This mechanism exists to protect
future users without exposing private relay activity or creating a portable
accusation record.

An upward safety report must be coarse, unlinkable outside the issuing relay,
and minimized. It must not reveal:

- the private relay's name or purpose
- the private relay's membership
- the event, group, or organizing context
- direct-message contents
- a detailed narrative accusation
- a stable private-relay pseudonym
- a public ban label

An upward safety report may indicate only that a device presenting a specific
relay-scoped attestation token was associated with a safety concern inside the
private relay. The issuing relay may use this signal as one input when deciding
whether to issue future social or organizing capability attestations.

The issuing relay must treat upward reports as untrusted safety signals, not as
proof. A single report must not create a permanent ban or portable negative
label. Reports should require corroboration, decay over time, and be weighted by
the reporting relay's own local trust and abuse history where that can be done
without compromising relay blindness.

After submission, the private relay should destroy local report records
according to its retention policy or destruction key. The issuing relay must not
expose report reason codes to future private relays.

---

## 11. Planner Customization And Knowledge Graph Enrichment

The planner should be structured as an event graph, not a free-form custom form
system. Groups customize language, templates, views, required fields, thresholds,
and local graph vocabulary. They do not customize the canonical object model.

### 11.1 Canonical Planner Primitives

```
Event
Place
TimeWindow
Role
Task
Resource
Need
Offer
Constraint
Risk
Decision
Dependency
AttendanceSignal
Outcome
```

### 11.2 Planning Packs

Groups customize the planner through planning packs:

```
planning_pack = {
  id,
  label,
  extends,
  vocabulary,
  templates,
  required_fields,
  graph_relations,
  privacy_defaults
}
```

Example:

```
id: mutual-aid-distribution
label: Mutual Aid Distribution
extends: groundwork.event.v1

vocabulary:
  event_label: Distribution
  place_label: Site
  task_label: Shift
  role_label: Crew Role

templates:
  - name: Food distribution
    creates:
      roles: [site lead, intake, runner, driver]
      tasks: [setup, intake, distribute, cleanup]
      resources: [tables, food boxes, water, bags]

privacy:
  default_retention: destroy_with_relay
  attendance_identity: count_only
```

### 11.3 Graph Enrichment

The map enriches planning through typed graph relationships:

```
Place -> hasNeed -> FoodAccess
Event -> addressesNeed -> FoodAccess
Task -> requiresResource -> Cooler
Role -> responsibleFor -> Task
Risk -> appliesTo -> Place
Outcome -> updatesTrustSignal -> StewardshipCompleted
```

The knowledge graph may suggest roles, resources, time windows, risks, or
related pins. It must respect privacy classes and relay destruction policy.

### 11.4 Fun App Surface

The public app should feel like a living local map where crews make things
happen. The planner can present canonical objects with friendlier language:

```
Event     -> Run / Drop / Fix / Circle
Task      -> Step
Role      -> Slot
Resource  -> Bring
Need      -> Pin
Outcome   -> Trace
Trust     -> Standing
Relay     -> Crew Space
```

Retention loops should emphasize small, useful actions:

```
See something nearby
-> add it to the map
-> invite a few people
-> do a tiny action
-> leave proof that the place changed
-> unlock richer crew tools
-> repeat
```

Progress must map to capability eligibility, not public identity status.
Groundwork should avoid leaderboards or social ranking systems that pressure
users to expose themselves.

---

## 12. Spatial Stewardship Cells

GOCP stations may act as seed nodes in a weighted Voronoi service map. Every
street, pin, job, route, and stewardship action can be assigned to the nearest
capable node.

Initial seed nodes:

```
Uptown
Paseo
Midtown
Southside
Capitol Hill
```

Plain Voronoi asks which station is closest. Weighted Voronoi asks which station
is closest after accounting for capacity, availability, equipment, trust, and
route friction.

```
effective_distance =
  physical_distance
  * capacity_multiplier
  * availability_multiplier
  * route_friction
```

If Uptown is over capacity, its effective distance grows and its cell contracts.
Nearby work can route toward Midtown or Paseo if those nodes have spare
capacity. The boundary becomes a behavioral incentive without manually drawing
zones.

```
SeedNode
  id
  name
  location
  capacity
  active_load
  equipment
  steward_pool
  reward_wallet
  trust_threshold
  status

ServiceCell
  seed_node_id
  polygon
  current_weight
  calculated_at

MapObject
  id
  type: pin | job | route | need | offer | event
  location
  assigned_seed_node_id
  assigned_cell_id
  reward_policy
```

Use civic language such as `Steward`, `Cell Lead`, `Operating Node`, `Relay
Pool`, or `Responsible Crew` rather than public "ownership" of civic space.

---

## 13. Behavioral Trust Scoring

The trust score that underlies GRTAP attestations is built from behavioral
signals, not identity claims.

### 13.1 Positive Signals

```
Verified stewardship jobs:
  Simple cleanup job completed:     +2.0 points
  Skilled stewardship completed:    +4.0 points
  Job completion rate sustained:    +1.0 points/month

Resource contributions:
  Pin confirmed first time:         +0.5 points
  Pin confirmed repeat location:    +0.2 points
  New pin added and verified:       +1.5 points

Community signals:
  Partner organization vouch:       +5.0 points one time
  Keeper vouch:                     +3.0 points one time
  Attendance credit proof:          +1.0 points

Time signals:
  Account age 30 days:              +1.0 points
  Account age 90 days:              +2.0 points
  Account age 1 year:               +5.0 points
  Consistent weekly activity:       +0.5 points/month
```

### 13.2 Negative Signals

Negative signals are applied silently and locally. They affect capability
eligibility; they do not become portable labels.

```
Behavioral anomalies:
  location spoofing pattern
  sudden trust-seeking spike
  repeated evasion after restriction
  suspected surveillance pattern

Community safety:
  corroborated reports
  repeated boundary violations
  repeated job abandonment
  invite or DM abuse

Recognition:
  local-only recurrence after restriction
  repeated account churn associated with unsafe behavior
```

Persistent fingerprints must not be used as a portable source of truth.
Recognition is local, conservative, decaying, and non-exportable.

### 13.3 Threshold Classes

```
public:       public map and low-risk viewing
contributor:  confirmed contributor, crew work
established:  repeated participation, trusted crew
trusted:      organizing parties, sensitive relay access
keeper:       relay operation, vouch capability, governance actions
```

---

## 14. Organizing Use Case

A group wants to organize a peaceful public assembly. They need:

- a private communication channel
- confidence that members are genuine community participants
- protection from law enforcement surveillance
- protection from agent infiltration
- protection from predatory or coercive social behavior
- a way to coordinate attendance without preserving a roster
- the ability to destroy all records after the event

GRTAP v0.2 enables this as follows:

1. A trusted organizer spins up a private relay.
2. They select the `Sensitive Assembly` preset.
3. They require `trusted` capability plus invite or vouch.
4. Members request relay-scoped capability attestations.
5. Members join by presenting valid attestations.
6. The private relay creates local session pseudonyms only.
7. Attendance uses aggregate count proof by default.
8. Attendance credit, if enabled, is optional and participant-controlled.
9. The issuing relay does not know the relay purpose, event, membership, or
   attendance roster.
10. The private relay does not know real-world identity, issuing relay device
    IDs, raw behavioral profile, or main relay history.
11. After the assembly, the organizer triggers destruction.
12. Event commitments, counters, messages, nullifiers, and local pseudonyms are
    destroyed according to policy.

The protocol must not create records that assist reconstruction of a peaceful
assembly's membership, movement, leadership, or attendance list.

---

## 15. Open Questions For V0.3

- Full ZK range proof implementation for trust and safety thresholds.
- Multi-relay positive trust aggregation without linking activity.
- Blind upward safety reporting that further hides the submitting relay.
- Offline attestation for LoRa mesh or GOCP terminal relay access.
- Hardware-backed attestations without vendor identity leakage.
- Threshold signatures for relay governance and destruction.
- Formal verification of nullifier scope and unlinkability.
- Abuse-resistant recovery when a user loses a device.

---

## 16. Implementation Notes

The relay software should be a standalone process that technically capable
organizers can deploy on a VPS, local machine, Raspberry Pi, or GOCP station.

Implementation should prioritize:

- audited cryptographic libraries
- minimal retention defaults
- preset-based relay configuration
- clear user-facing privacy summaries
- capability-based social permissions
- local-only safety recognition
- ZK or blind-signature attendance proofs
- destructive relay teardown
- reproducible builds and community auditability

Reference implementation target:

```
github.com/sigmoidd/grtap
```

---

## 17. Licensing

CC0 1.0 Universal Public Domain Dedication.

No rights reserved. Implement it. Audit it. Improve it. Deploy it.

The right to organize, assemble, and speak freely is not a feature. It is the
reason this protocol exists.

Attribution appreciated but not required:

Groundwork Relay Trust Attestation Protocol (GRTAP)  
Christian Adkins - OKC 2026 - ourgroundwork.city

---

*Living document. Security researchers welcome.*  
*github.com/sigmoidd/grtap*
