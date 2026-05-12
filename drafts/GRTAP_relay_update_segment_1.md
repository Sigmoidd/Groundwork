# GRTAP Relay Update - Segment 1 Review Draft

## Behavioral Safety Boundary

Behavioral safety profiles are never exported between relays. The issuing relay
may evaluate local behavioral risk signals, but private relays receive only
unlinkable, relay-scoped capability attestations proving that a device satisfies
the requested safety and trust threshold.

Groundwork may use behavioral safety signals to protect social and organizing
surfaces, but behavioral profiles MUST NOT become portable identity records.

The issuing relay MAY evaluate local behavioral signals to decide whether a
device is eligible for a social or organizing capability. The issuing relay
MUST NOT export the underlying behavioral profile, raw signal bits, device
fingerprint, interaction graph, or negative safety label to a private relay.

Private relays receive only cryptographic capability attestations. These
attestations prove that the presenting device satisfies the requested trust and
safety threshold for a specific relay-scoped action. They do not reveal why the
device qualified, why another device failed to qualify, or what behavioral
signals were evaluated.

### Design rules

Positive trust may be portable as a cryptographic proof.

Behavioral risk must remain local to the relay that observed it, except where
it affects whether a relay-scoped capability token is issued.

Recognition is not identity. A relay MAY recognize a returning unsafe device or
actor for its own local safety decisions, but it MUST NOT export that recognition
state to another relay.

### Internal safety profiles

An issuing relay MAY maintain an internal behavioral safety profile for a
device or local pseudonymous actor. This profile MAY include coarse, minimized,
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

These features SHOULD be coarse, decaying, and purpose-limited. They SHOULD NOT
be treated as a permanent identity, and SHOULD NOT be exported between relays.

### Restricted signal classes

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

If used at all, these signals MUST be local, coarse, salted or otherwise
unlinkable, short-lived, and excluded from portable attestations. They MUST NOT
be a source of truth for identity, because users can switch devices, share
devices, lose devices, or use accessibility tools that alter these signals.

### Local-only re-identification

GRTAP v0.1 allowed a new account that matched a banned device to inherit the
prior account's trust modifier. This update narrows that mechanism.

The issuing relay MAY use local recognition mechanisms to protect its own public
map, social surfaces, trust issuance, and abuse response. For example, if a
device or local actor repeatedly creates new accounts after capability
restrictions, the issuing relay MAY apply a degraded starting trust score or deny
specific future capability attestations.

This recognition state is local to the issuing relay. It MUST NOT be transmitted
to private relays as a fingerprint, ban label, cross-relay risk score, reason
code, or profile feature. A private relay only learns whether a relay-scoped
capability attestation is valid.

Local re-identification SHOULD be used conservatively:

- it SHOULD rely on multiple weak signals rather than one persistent fingerprint
- it SHOULD decay over time unless unsafe behavior continues
- it SHOULD support review or appeal for high-impact restrictions
- it SHOULD avoid biometric, accessibility-revealing, or precise device signals
- it MUST NOT be used to create a permanent cross-relay identity

### Private relay safety guarantee

A private relay MAY ask:

> Does this device currently satisfy the safety and trust requirements for this
> organizing capability?

A private relay MUST NOT receive:

- the device's behavioral profile
- raw safety signal bits
- a cross-relay risk score
- a permanent ban label
- a reason code that exposes allegations or reports
- direct-message metadata from the issuing relay
- a stable fingerprint usable across relays

### Upward safety reporting

A private relay that observes a serious safety concern MAY submit a narrow
upward safety signal to the issuing relay. This mechanism exists to protect
future users without exposing private relay activity or creating a portable
accusation record.

An upward safety report MUST be coarse, unlinkable outside the issuing relay, and
minimized. It MUST NOT reveal:

- the private relay's name or purpose
- the private relay's membership
- the event, group, or organizing context
- direct-message contents
- a detailed narrative accusation
- a stable private-relay pseudonym
- a public ban label

An upward safety report MAY indicate only that a device presenting a specific
relay-scoped attestation token was associated with a safety concern inside the
private relay. The issuing relay MAY use this signal as one input when deciding
whether to issue future social or organizing capability attestations.

The issuing relay MUST treat upward reports as untrusted safety signals, not as
proof. A single report MUST NOT create a permanent ban or portable negative
label. Reports SHOULD require corroboration, decay over time, and be weighted by
the reporting relay's own local trust and abuse history where that can be done
without compromising relay blindness.

After submission, the private relay SHOULD destroy local report records
according to its retention policy or destruction key. The issuing relay MUST NOT
expose report reason codes to future private relays.

### Capability-based restriction

Safety enforcement should restrict capabilities rather than identify people.
Examples:

- can view public map
- can confirm pins
- can join crews
- can send direct-message requests
- can invite members
- can create events
- can join organizing parties
- can access private relays
- can vouch for others

If a device or local actor presents concerning behavior, the relay should reduce
or revoke specific social capabilities. The user should not be publicly labeled,
and other relays should not receive a portable accusation record.
