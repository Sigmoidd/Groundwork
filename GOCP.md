# GROUNDWORK OPEN CHARGE PROTOCOL

## Version 0.2 Draft Specification

### Christian Adkins — Groundwork OKC — May 2026

### Open Protocol — CC0 Public Domain

-----

## 1. OVERVIEW

The Groundwork Open Charge Protocol (GOCP) is a royalty-free open standard
for distributed civic charging infrastructure. Any device. Any station.
Any operator. No central authority required.

**Core insight:** GOCP is not a purpose-built charger. It is a managed
power station with NFC authentication and metering. Devices bring their
own charging hardware. GOCP provides the power, the auth, the metering,
and the map integration.

**The three outputs of every GOCP station:**

1. A 300mm x 300mm inductive landing pad (drones, phones, Qi devices)
1. A standard 3-prong 120V outlet (any device with a plug)
1. USB-A and USB-C ports (phones, small devices, no brick needed)

A power wheelchair user brings their own charger and uses the outlet.
A drone lands on the pad. A cyclist plugs in their e-bike charger.
A person without housing charges their phone on USB.
Same station. Same tap. Same dignity.

-----

## 2. PHYSICAL DESIGN

### 2.1 The Pad (300mm x 300mm inductive surface)

The pad uses a 3x3 coil array (9 coils, each ~90mm diameter, overlapping)
driven by a multiplexed Qi transmitter array. Power transfer is effective
anywhere on the pad surface within +/- 130mm of center.

This means:

- A ground drone drives onto the pad, stops anywhere, charges
- An aerial drone lands with normal landing tolerance, charges
- A phone or small device placed anywhere on the pad charges
- No precise alignment required for any device class

**Pad construction:**

- Top surface: tempered glass or polycarbonate, 4mm, weatherproof
- Coil layer: 9x Qi transmitter coils, litz wire, potted in epoxy
- Driver layer: 3x WR3 or equivalent multi-coil Qi IC
- Thermal layer: aluminum backing plate with passive fins
- Bottom: mounting interface plate (see Section 2.3)

**Pad specs:**

- 300mm x 300mm x 18mm total thickness
- Max power delivery: 45W total across pad surface
- Per-coil max: 15W
- Operating temperature: -20C to 60C
- IP65 weatherproof

### 2.2 The Control Box

Separate from the pad. Connected by weatherproof cable.
Mounts to post, wall, or surface depending on deployment.

**Outputs:**

- 1x 300mm pad (via 18AWG cable, max 5A)
- 1x 3-prong 120V NEMA 5-15 outlet (standard US plug, 15A max)
- 1x USB-A 12W (5V/2.4A)
- 1x USB-C 65W PD (5V/3A, 9V/3A, 12V/3A, 20V/3.25A)

**Electronics:**

- ESP32-S3 main controller
- PN532 NFC reader (ISO 14443A/B, 13.56 MHz)
- INA219 current sensor per output (4 total)
- Smart relay per output (normally open, closes on auth)
- USB PD controller IC (HUSB238 or AP33772)
- 30W AC-DC supply for logic and USB ports
- Status LED ring: idle/negotiating/charging/fault
- Optional OLED: station ID, active sessions, power draw
- Weatherproof enclosure IP65, NEMA 4X rated

**Connectivity:**

- WiFi for Groundwork map reporting (optional, not required)
- Bluetooth LE for local device pairing fallback
- Works fully offline with no network connection

### 2.3 Modular Mounting System

The pad and control box share a common 4-bolt GOCP mounting interface
(80mm x 80mm bolt pattern, M5 bolts).

**Mount types (all use same interface):**

POST MOUNT

- 2-inch schedule 40 pipe clamp
- Pad sits horizontal on top of post
- Control box on post below pad
- Best for: sidewalks, park paths, transit stops
- Install time: 15 minutes with basic tools

GROUND MOUNT

- Flush mount frame, stakes into soil or bolts to concrete
- Pad sits level with or just above ground surface
- Best for: community gardens, park lawns, drone landing zones
- Install time: 20 minutes

SURFACE MOUNT

- L-bracket for tables, benches, railings
- Pad on horizontal surface, box underneath
- Best for: outdoor cafes, library patios, bus shelters
- Install time: 10 minutes

WALL MOUNT

- Flat bracket, pad faces up at angle or horizontal shelf
- Best for: building exteriors, covered walkways
- Install time: 15 minutes with wall anchors

All mounts are designed for one person with a drill and a wrench.
No electrician required for post/surface/wall mount on existing outlet.
Hardwired ground mount requires licensed electrician.

-----

## 3. SESSION PROTOCOL

### 3.1 Free / Open Mode (default)

No NFC required. Device present detection via:

- Inductive: Qi foreign object detection triggers open session
- Outlet: current draw above 0.1A triggers open session
- USB: device connect triggers open session

Station enables power at Tier 1 (5W inductive) or full power
(outlet and USB) depending on operator configuration.

Open mode is the correct default for parks, libraries, gardens,
and any civic deployment where access is the goal.

### 3.2 Metered Mode (optional)

Operator enables metered mode via web config interface.

```
STEP 1 — TAP
  Device or user taps NFC tag or card to station reader
  Tag contains (NDEF format):
    GOCP version
    Device class
    Requested output (PAD / OUTLET / USB_A / USB_C)
    Requested tier (or AUTO for station to assign)
    Session token (random, 32-bit)
    Device UUID (persistent, never published)

STEP 2 — AUTHORIZE
  Station checks operator pricing config
  Station enables requested output
  Station returns session confirmation via BLE or NFC write:
    Station ID
    Assigned tier
    Pricing mode and rate
    Session start timestamp

STEP 3 — CHARGE
  Station meters all outputs at 1Hz via INA219
  LED indicates active session per output

STEP 4 — END
  User taps again to end session OR
  Device removed and 30s timeout passes OR
  Operator configured time limit reached

  Station publishes anonymized session record (optional):
    Station ID, device class, output used,
    Wh delivered, duration, pricing mode
    Session token only — device UUID never published
```

-----

## 4. POWER TIERS

|Tier|Output|Voltage|Max Power|Target use             |
|----|------|-------|---------|-----------------------|
|1   |Pad   |Qi 5W  |5W       |Phones, small devices  |
|2   |Pad   |Qi 15W |15W      |Ground drones, tablets |
|3   |Pad   |Qi 45W |45W      |Aerial drones, charging|
|4   |USB-C |5-20V  |65W      |Laptops, cargo drones  |
|5   |Outlet|120V   |1800W    |Any device with a plug |

Tier 5 (outlet) is not tier-limited by GOCP. The device’s own charger
determines power draw. The station meters and can set a session energy cap.

Power wheelchairs, e-bikes, and mobility scooters use Tier 5.
They bring their own charger. GOCP just provides the outlet and the auth.

-----

## 5. COIL ARRAY GEOMETRY

```
300mm x 300mm pad, 3x3 coil array

  [C1][C2][C3]
  [C4][C5][C6]
  [C7][C8][C9]

Each coil: 90mm diameter, 15mm overlap with neighbors
Driver assignment:
  Driver A: C1, C2, C4, C5 (top-left quadrant priority)
  Driver B: C2, C3, C5, C6 (top-right quadrant priority)
  Driver C: C5, C6, C8, C9 (bottom-right quadrant priority)
  (C5 center coil shared across all drivers)

Foreign object detection on each coil independently.
Active coils energized based on where device presence detected.
Inactive coils in standby (< 0.1W draw).

Positioning tolerance: +/- 130mm from pad center
Effective charging zone: full 300mm x 300mm surface
```

-----

## 6. NFC TAG STRUCTURE

```
Bytes 0-3:   GOCP magic (0x474F4350)
Byte  4:     Version (0x02)
Byte  5:     Device class
               0x01 = DRONE_GROUND
               0x02 = DRONE_AERIAL
               0x03 = MOBILITY_SCOOTER
               0x04 = EBIKE
               0x05 = POWER_WHEELCHAIR
               0x06 = PHONE
               0x07 = LAPTOP
               0xFF = OTHER
Byte  6:     Requested output
               0x01 = PAD
               0x02 = OUTLET
               0x03 = USB_A
               0x04 = USB_C
               0x00 = AUTO (station decides)
Byte  7:     Requested tier (0x00 = AUTO)
Bytes 8-11:  Session token (uint32, random per session)
Bytes 12-15: Device UUID (persistent, local only, never transmitted)
Bytes 16-47: Device name (ASCII, optional, null terminated)
Bytes 48-255: Reserved
```

-----

## 7. STATION ID AND MAP INTEGRATION

Format: GOCP-[STATE]-[CITY]-[SEQUENCE]
Example: GOCP-OK-OKC-00001

Each station ID maps to a Groundwork pin with:

- Location coordinates
- Operator name (optional)
- Outputs available
- Pricing mode
- Last active timestamp
- Uptime percentage (from session reports)

Session report (anonymized, optional WiFi push):

```json
{
  "station_id": "GOCP-OK-OKC-00001",
  "session_token": "A3F2910B",
  "device_class": "DRONE_GROUND",
  "output_used": "PAD",
  "tier": 2,
  "wh_delivered": 8.4,
  "duration_seconds": 612,
  "timestamp_utc": "2026-05-08T23:14:00Z",
  "pricing_mode": "FREE"
}
```

-----

## 8. BILL OF MATERIALS — STATION V1

### Control Box (target: $42-50)

|Component                        |Est cost|
|---------------------------------|--------|
|ESP32-S3 dev board               |$6      |
|PN532 NFC module                 |$4      |
|USB PD controller (HUSB238)      |$4      |
|INA219 x4                        |$6      |
|Smart relay x4 (5V coil)         |$6      |
|30W AC-DC supply (5V/3A + 12V/2A)|$8      |
|NEMA 5-15 outlet receptacle      |$3      |
|USB-A 12W module                 |$2      |
|IP65 enclosure                   |$6      |
|Misc (LEDs, terminals, cable)    |$5      |
|**Total**                        |**$50** |

### Inductive Pad (target: $35-45)

|Component                        |Est cost|
|---------------------------------|--------|
|Qi transmitter coils x9          |$18     |
|Multi-coil Qi driver IC x3       |$9      |
|Polycarbonate top surface 300x300|$6      |
|Aluminum backing plate           |$4      |
|Mounting interface plate         |$3      |
|Potting epoxy + misc             |$4      |
|**Total**                        |**$44** |

### Mount (varies by type: $8-15)

**Total station V1: $93-109**
Target retail (operator cost): $120-150
Target retail (consumer kit): $89 DIY

-----

## 9. OPERATOR QUICK START

1. Mount station using chosen mount type
1. Plug into existing 120V outlet
1. Scan QR code on station to register on Groundwork map
1. Set pricing mode (recommend FREE for civic deployments)
1. Done. Station is live.

No electrician. No permit for plug-in deployment.
No ongoing fees. No central operator dependency.
The station works if Groundwork goes offline.

-----

## 10. LICENSING

CC0 1.0 Universal Public Domain Dedication.

No rights reserved. Build it. Sell it. Fork it. Improve it.

Attribution appreciated but not required:
Groundwork Open Charge Protocol (GOCP)
Christian Adkins — OKC 2026 — groundworkokc.org

Suggested repository: github.com/sigmoidd/gocp

-----

## 11. V2 ROADMAP

- Visual alignment assist (LED ring on pad guides drone landing)
- Solar input panel for off-grid park deployment
- Mesh networking between stations for load balancing
- Larger pad tiles (600mm x 600mm) for full-size aerial drones
- Mutual authentication for high-value metered deployments
- Physical tamper detection and remote disable
- 48V output tier for power wheelchairs (direct, no user charger needed)
- Weather station integration (wind speed gate for aerial drone charging)

-----

*Living document. Pull requests welcome.*
*github.com/sigmoidd/groundwork/GOCP.md
