# Groundwork Routing - Casual User Copy Layer
## Version 0.1 Draft

This companion copy guide keeps the routing engine understandable to everyday
users. The product should feel like OKC's better map, not a policy dashboard.

## Copy Principle

The router may use equity, weather, accessibility, topology, safety, and amenity
weights internally. The user-facing copy should describe the benefit plainly:

```txt
Better route.
Cooler walk.
Less traffic stress.
More shade.
Easier with kids.
Step-free path.
Coffee on the way.
```

Do not ask users to choose stigmatizing modes. Do not say "homeless mode,"
"vulnerable route," "equity route," or "risk-adjusted routing" in ordinary UI.

## Core App Promise

Use:

```txt
Tell Groundwork where you want to go. It finds the route that fits.
```

Also good:

```txt
Plan a walk, ride, errand, or Saturday out.
```

```txt
Routes that know shade, sidewalks, water, coffee, events, and real OKC streets.
```

Avoid:

```txt
Equity-optimized multimodal dignity-aware routing engine.
```

```txt
Declare your vulnerability state vector.
```

```txt
Select demographic mode.
```

## One-Sentence Search

Placeholder:

```txt
Where to?
```

Examples:

```txt
Walk me to the library
30-minute loop from here
Plan a Saturday morning that ends at a brewery
Bike to Cuppies and avoid May Ave
Find a shower I can use today
Coffee on the way to the park
```

Button:

```txt
Plan route
```

Alternative button for day plans:

```txt
Build my day
```

## Route Result Copy

Default route title:

```txt
Best fit
```

Short route summary:

```txt
18 min walk - mostly shaded - passes water
```

```txt
12 min ride - quieter streets - bike rack near the stop
```

```txt
Step-free route - curb cuts checked - smoother sidewalks
```

When there is a small detour:

```txt
Adds 3 minutes for shade and water.
```

```txt
Adds 2 minutes to avoid rough sidewalk.
```

```txt
Adds 4 minutes for quieter streets.
```

Avoid:

```txt
Exposure multiplier increased route cost.
```

```txt
Surface penalty applied due to non-ambulant mobility state.
```

## Tap-To-Switch Nudges

Use:

```txt
Bike share could save 9 minutes.
```

```txt
A scooter could make this a 6 minute trip.
```

```txt
Bus + walk is easier for this distance.
```

Actions:

```txt
Show bike option
Show scooter option
Show bus option
Keep walking
```

Avoid:

```txt
Mode switch recommended by micromobility nudge engine.
```

## Accessibility Copy

Use:

```txt
Step-free path
```

```txt
Curb cuts checked
```

```txt
Avoids rough sidewalk
```

```txt
Wider sidewalks where possible
```

```txt
This route may include an unverified curb cut.
```

Avoid:

```txt
Wheelchair user route
```

```txt
Disabled mode
```

```txt
Non-ambulant penalty
```

## Heat, Cold, And Weather Copy

Use:

```txt
Cooler walk
```

```txt
More shade
```

```txt
Passes water
```

```txt
Warmer indoor stops nearby
```

```txt
Rain is likely. Want a shorter route?
```

Avoid:

```txt
Heat vulnerability route
```

```txt
HVI-adjusted exposure cost
```

## Dignified Services Copy

Use:

```txt
Open now
```

```txt
Walk-ins welcome
```

```txt
No ID listed
```

```txt
No referral listed
```

```txt
Call first
```

```txt
May require intake
```

Avoid:

```txt
Homeless service route
```

```txt
Low-barrier vulnerability amenity
```

```txt
Sobriety friction penalty
```

## Day-Out Planning Copy

Use:

```txt
Your Saturday plan
```

```txt
Chill morning
```

```txt
Coffee first, murals next, brewery at the end.
```

```txt
Swap this stop
```

```txt
Running late? Replan the rest.
```

Avoid:

```txt
Multi-leg optimization response
```

```txt
Modal coherence penalty
```

## Contribution Copy

Use:

```txt
Sidewalk closed?
```

```txt
Water fountain broken?
```

```txt
Add a quick update
```

```txt
Thanks. This helps the next person.
```

Avoid:

```txt
Submit topology correction
```

```txt
Contribute edge attribute verification
```

## Visibility Copy

Use:

```txt
Public
```

```txt
Shown only when useful
```

```txt
Trusted callers only
```

Avoid exposing internal labels like:

```txt
matched
verified_only
visibility predicate
```

## Error Copy

No route:

```txt
I could not find a good route yet.
```

Missing sidewalk data:

```txt
This area needs better sidewalk data.
```

Closed path:

```txt
That path may be closed.
```

Need clarification:

```txt
Walking or biking?
```

```txt
Mostly food, outdoors, or a mix?
```

Too many constraints:

```txt
I can do that, but I need one thing first.
```

## Internal-To-External Translation

```txt
state vector                 -> trip details
amenity attraction           -> good stops nearby
exposure multiplier          -> heat, cold, and shade
surface multiplier           -> sidewalk comfort
topology                     -> real paths
detour bound                 -> keeps the route reasonable
micromobility nudge          -> another way to go
visibility control           -> shown only when useful
```

## Golden Rule

If a phrase sounds like it belongs in the specification, keep it out of the app.

If a phrase helps someone decide what to do next, it belongs in the app.
