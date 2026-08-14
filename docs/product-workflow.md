# Swasth — How the App Works

A plain-English walkthrough of the whole product: who uses it, what each person
can do, and the exact steps they go through. No technical terms.

This is a **proposal for you to correct**. Nothing here is decided. Strike out
what the gym doesn't do, add what's missing, and the surviving document becomes
our build order.

---

## 1. Who uses Swasth

Swasth is built for **one gym** — not a chain. Four kinds of people touch it.

| Person          | Where they use it     | In one line                                                           |
| --------------- | --------------------- | --------------------------------------------------------------------- |
| **Member**      | Mobile app            | Joins the gym, books classes, checks in, tracks progress               |
| **Trainer**     | Mobile app            | Takes classes and personal sessions, assigns workouts, marks attendance |
| **Gym Admin**   | Admin panel (web)     | Runs the day-to-day: members, payments, schedule, front desk           |
| **Owner**       | Admin panel (web)     | Everything an admin can do, plus pricing, staff and money reports       |

> The **member and trainer share one mobile app** — a trainer simply sees extra
> screens after logging in. The **admin and owner share one web panel**, with the
> owner seeing extra sections. That's two products to build, not four.

---

## 2. The member's journey

### 2.1 Joining (first ten minutes)

1. **Download & open.** A welcome screen shows what the gym offers — photos,
   timings, location, the classes on offer.
2. **Enter mobile number.** No passwords, no email, no forms.
3. **Enter the 6-digit code** received by SMS. The account is created on the
   spot — there is no separate "sign up" versus "log in". If the number is new,
   it becomes a new account; if it's known, they're simply logged back in.
4. **Onboarding questions** (skippable, but nudged):
   - Name, gender, date of birth, city
   - Height and current weight
   - **Goal** — lose weight / build muscle / stay fit / improve stamina / recover from injury
   - **Current activity level** — beginner / occasional / regular
   - Any injuries or medical conditions the trainer should know about
5. **Land on the home screen.** At this point they are a *visitor*: they can see
   everything, but can't check in or book until they hold a membership.

### 2.2 Becoming a paying member

There are **two ways** a person becomes a member, and both must work:

**Path A — in the app (self-serve)**

1. Member opens **Plans** and sees what the gym sells — e.g. 1 month, 3 months,
   6 months, 12 months, with the per-month price and savings shown on each.
2. Optional add-ons appear alongside: personal training packs, a locker,
   nutrition consultation.
3. They pick a plan → see a summary (start date, end date, total, any discount
   or coupon) → pay in the app.
4. Payment succeeds → membership is **active immediately**, receipt is available
   in the app, and a welcome message arrives.

**Path B — at the front desk (walk-in)**

1. Someone walks into the gym and pays by cash, card or UPI at the desk.
2. The **admin creates the membership** in the panel against their mobile number.
3. The member downloads the app, logs in with that same number, and their
   membership is **already there**.

> This second path matters more than it looks. Most Indian gyms still sell the
> majority of memberships at the desk. If the app only supports in-app payment,
> the front desk keeps its paper register and the app never becomes the source
> of truth.

**Free trial / day pass.** Optionally, a first-timer can book a single free trial
session or buy a one-day pass without a full membership.

### 2.3 A normal gym visit

1. Member arrives at the gym.
2. Opens the app → **Check in**. The app shows a QR code, which the front desk
   scans. (Alternative: the gym displays one QR at the entrance and the *member*
   scans it. Cheaper — no scanner hardware needed. **You need to pick one.**)
3. Check-in is recorded. Their attendance streak updates.
4. On the way out, they check out — or the system closes the visit automatically
   at closing time.

What check-in gives everyone: the member sees their consistency, the trainer
knows who showed up, and the admin sees live occupancy and who has stopped
coming.

### 2.4 Booking a group class

1. **Classes** tab shows today's schedule: Yoga 6:00 AM, HIIT 7:00 AM, Zumba
   7:00 PM — each with the trainer's name, duration, difficulty, and **spots
   left**.
2. Member picks a class and taps **Book**. It's instant — a spot is held.
3. If the class is **full**, they join a **waitlist** and are promoted
   automatically (with a notification) if someone cancels.
4. A reminder arrives before the class.
5. They attend; the trainer marks them present.
6. **Cancelling:** free up to a cutoff (say 2 hours before). After that, or if
   they book and don't turn up, it counts as a **no-show**.

> **No-shows are the real problem to solve here.** A member who books a 6 AM slot
> and doesn't come has taken a spot from someone who would have used it. Gyms
> usually respond with a strike policy — e.g. three no-shows in a month blocks
> advance booking for a week. You need to decide whether Swasth polices this at
> all, and how hard.

### 2.5 Personal training

1. Member buys a **PT pack** — e.g. 12 sessions valid for 3 months — either in
   the app or at the desk.
2. They choose a trainer, or the admin assigns one.
3. They see that trainer's free slots and book a session.
4. Session happens; the trainer marks it complete; **one session is deducted**
   and the remaining balance is visible to both.
5. The pack expires on its end date whether or not sessions remain — a policy
   worth stating clearly in the app to avoid disputes.

### 2.6 Workouts and progress

- The trainer assigns a **workout plan** — e.g. a 6-day push/pull/legs split.
  The member sees today's workout: exercises, sets, reps, target weight.
- The member **logs each set** as they train. Next session, the app shows what
  they lifted last time.
- A **diet plan** may also be assigned, if the gym offers nutrition.
- **Progress** tab shows: weight over time, body measurements, BMI, before/after
  photos, workouts completed, attendance streak, personal bests.

### 2.7 Living with the membership

| Situation                     | What the member does                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Membership about to expire    | Gets reminders at 15, 7 and 1 day out; renews in one tap, keeping the same plan   |
| Travelling / ill for a month  | Requests a **freeze** — the clock stops, end date shifts. Admin approves          |
| Wants to quit                 | Requests cancellation; admin handles the refund per gym policy                    |
| Wants to upgrade              | Moves from 3-month to annual, paying the difference                               |
| Brings a friend               | Shares a **referral code**; both get a reward when the friend joins               |
| Has a problem                 | Raises a support request, or calls the gym directly from the app                  |

### 2.8 What the member sees — screen map

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│    HOME     │   CLASSES   │  PROGRESS   │   PROFILE   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ Membership  │ Today's     │ Weight &    │ My details  │
│ status      │ schedule    │ measurements│             │
│             │             │             │ Membership  │
│ Check in    │ Book a      │ Attendance  │ & payments  │
│ (QR)        │ class       │ streak      │             │
│             │             │             │ My trainer  │
│ Today's     │ My bookings │ Workout     │             │
│ workout     │             │ history     │ Refer a     │
│             │ Book a PT   │             │ friend      │
│ Announce-   │ session     │ Photos      │             │
│ ments       │             │             │ Help &      │
│             │ Waitlist    │ Personal    │ support     │
│ Streak      │             │ bests       │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## 3. The trainer's journey

The trainer logs into the **same app** with their number, and sees a different
home screen.

**Their day:**

1. Morning: opens the app and sees **today's schedule** — the classes they're
   taking and the PT sessions booked with them.
2. Before a class: sees the **list of members booked in**, including any injuries
   or conditions flagged at onboarding.
3. During: **marks attendance** — present, absent, late.
4. After a PT session: marks it complete (deducting a session) and writes a short
   note on how the member performed.
5. Anytime: **assigns or updates workout plans** for the members allotted to them,
   and reviews logged workouts and progress.
6. Sets their **availability** — the hours they're free for PT bookings, and days
   they're on leave.

Trainers cannot see money, other trainers' members, or anything about the gym's
business.

---

## 4. The admin's journey

The admin works on a **web panel**, not the phone. This is where the gym is
actually run.

### 4.1 One-time setup

1. **Gym profile** — name, address, photos, amenities, contact number.
2. **Timings** — opening and closing hours per day, weekly off, holiday list.
3. **Membership plans** — name, duration, price, what's included, whether it's
   visible in the app or desk-only.
4. **Add-ons** — PT packs, lockers, nutrition consults.
5. **Trainers** — add each trainer, their specialisation, and give them app access.
6. **Class schedule** — e.g. "Yoga, 6:00–7:00 AM, Monday to Friday, Priya,
   capacity 20." Set once, repeats weekly.
7. **Policies** — cancellation window, freeze rules, refund rules, no-show rules.

### 4.2 Every day

| When    | What the admin does                                                          |
| ------- | ---------------------------------------------------------------------------- |
| Morning | Checks today's classes, trainer leave, and anyone who needs covering          |
| Ongoing | Registers walk-ins, records desk payments, checks members in if the desk scans |
| Ongoing | Approves freeze requests, handles cancellations and complaints                |
| Ongoing | Watches **live occupancy** — how many people are in the gym right now         |
| Evening | Follows up on **memberships expiring this week** and **dues not yet paid**    |

### 4.3 Every week / month

- **Renewals due** — who's expiring, who's already lapsed, who to call.
- **Dropping off** — members who haven't checked in for 2+ weeks. These are the
  people who quietly don't renew. Catching them early is the single most
  valuable report in the panel.
- **Money** — collected this month, split by plan, cash vs online, pending dues,
  refunds issued.
- **Class performance** — which slots fill up and which run near-empty, so the
  schedule can be reshaped.
- **Trainer utilisation** — sessions taken, members handled, attendance marked.
- **Announcements** — send a push to everyone or a segment: "Gym closed on the
  15th for maintenance", "New Zumba batch at 7 PM".

### 4.4 What only the owner sees

- Creating and pricing plans, running discounts and offers
- Full revenue reports and refunds
- Adding or removing admins and trainers
- Gym-wide settings and policies

---

## 5. The membership lifecycle

Every member sits in exactly one of these states, and the app behaves
differently in each.

```
   Visitor ──buys──> ACTIVE ──15 days left──> EXPIRING ──end date──> EXPIRED
   (app only)          │                          │                     │
                       │                          └──renews──> ACTIVE   │
                       │                                                │
                       ├──requests freeze──> FROZEN ──resumes──> ACTIVE │
                       │                                                │
                       └──cancels──> CANCELLED            ──rejoins─────┘
```

| State         | Can check in? | Can book classes? | What they see                         |
| ------------- | ------------- | ----------------- | ------------------------------------- |
| **Visitor**   | No            | No                | Plans, gym info, a nudge to join      |
| **Active**    | Yes           | Yes               | Everything                            |
| **Expiring**  | Yes           | Yes               | A renewal banner, growing more urgent |
| **Frozen**    | No            | No                | Resume date, option to resume early   |
| **Expired**   | No            | No                | Renewal screen, their old history kept |
| **Cancelled** | No            | No                | Rejoin option                         |

---

## 6. What the app tells people, and when

| Message                          | Goes to  | When                                    |
| -------------------------------- | -------- | --------------------------------------- |
| Login code                       | Member   | On request (SMS)                        |
| Welcome + membership confirmed   | Member   | Payment succeeds                        |
| Payment receipt                  | Member   | Every payment                           |
| Class reminder                   | Member   | 1 hour before a booked class            |
| "A spot opened up"               | Member   | Promoted off a waitlist                 |
| Class cancelled                  | Member   | Trainer on leave / gym closed           |
| Membership expiring              | Member   | 15, 7 and 1 day before expiry           |
| Membership expired               | Member   | On the day it lapses                    |
| "We miss you"                    | Member   | No check-in for 10 days                 |
| Streak milestone                 | Member   | 7 / 30 / 100 days                       |
| New workout plan assigned        | Member   | Trainer assigns it                      |
| Freeze approved / rejected       | Member   | Admin decides                           |
| Gym announcement                 | Everyone | Admin sends it                          |
| Tomorrow's schedule              | Trainer  | Evening before                          |
| New PT booking                   | Trainer  | Member books                            |
| Freeze / refund request pending  | Admin    | Member raises it                        |
| Daily summary                    | Admin    | End of day                              |

> Notifications are where fitness apps become annoying and get uninstalled. Every
> message above should be something the person can switch off, and the "we miss
> you" nudges especially need a limit.

---

## 7. Two days in the life

**Rohit, new member, Monday morning**

> Walks past the gym, downloads Swasth. Enters his number, gets a code, and is in
> within a minute. Answers five onboarding questions — he wants to lose weight,
> hasn't trained in two years. Sees the plans; the 3-month at ₹4,500 looks
> reasonable, but he taps **Book a free trial** instead and picks tomorrow's 7 AM
> HIIT class. He gets a confirmation, and a reminder at 6 AM the next day. He
> shows up, likes it, and buys the 3-month plan on his phone standing in the
> lobby. The front desk didn't have to do anything.

**Meera, gym admin, the same Monday**

> Opens the panel at 6 AM. Priya has messaged that she's ill, so Meera marks her
> on leave — the 6 AM Yoga class is cancelled and all fourteen booked members are
> notified automatically. Through the morning, two walk-ins join; she registers
> both against their mobile numbers and records their cash payments. At 11 she
> checks **Expiring this week** — nine members — and calls the four who haven't
> been in for a fortnight. One of them asks to freeze for a month because he's
> travelling; she approves it in two taps. At close, she glances at the day: 63
> check-ins, ₹11,800 collected, evening Zumba full again — worth adding a second
> batch.

---

## 8. Decisions I need from you

These change what gets built, so they're worth answering before we go far.

1. **Is this one gym, or will you sell Swasth to many gyms?** Everything above
   assumes one. Multi-gym is a very different foundation and is far cheaper to
   decide now than to retrofit.
2. **Check-in method** — does the front desk scan the member's phone (needs a
   scanner), or does the member scan a QR poster at the door (needs nothing)?
3. ~~**Payments**~~ — decided: **desk payments only, recorded manually.** No
   payment gateway for now.
4. **Are group classes part of this at all?** Some gyms are pure floor access
   with no classes. If so, a large chunk of section 2.4 disappears.
5. **Does the gym do personal training** through the app, or is PT arranged
   informally between member and trainer?
6. **Freeze policy** — allowed? How many days a year? Does it need approval?
7. **Refunds** — pro-rata, fixed deduction, or no refunds at all?
8. **No-show policy** — ignore it, or penalise it?
9. **Is the admin panel a web app or another mobile app?** I've assumed web.
10. **Trial or day pass** — offered or not?

---

## 9. Where we are today

The backend currently supports:

- **Section 2.1** — phone-number login, account creation, profile and onboarding
  questions.
- **Section 2.2, Path B** — the front desk registering a walk-in, plus searching,
  editing, suspending and reinstating members.
- **Sections 2.2 and 2.7 (partly)** — membership plans, selling one at the desk,
  renewals that stack, part payments in cash, cancellation, and the
  "expiring soon" follow-up list. No in-app purchase and no payment gateway:
  money is recorded by hand.
- **Section 2.2 plans and 2.7 renewals** — the price list, selling a plan,
  renewals that stack, part payments in cash, and the expiring-soon list. No
  payment gateway: the desk records cash by hand.
- The gym itself — onboarding a gym and its owner, and each app build knowing
  which gym it belongs to.

Everything else in this document is still to be built.

Decided since the first draft: **one database holds many gyms**, gyms are
onboarded one at a time by the Swasth team rather than self-serve, a phone
number is one person across all gyms, and each gym gets its own app build. That
answers question 1 in section 8.

A sensible build order, given the above:

1. ~~Admin registering a walk-in member~~ — **done**
2. ~~Membership plans and assigning one to a member~~ — **done**
3. Check-in and attendance *(the daily habit that gets the app opened)*
3. Payments and renewals
4. Class schedule and booking
5. Trainers, workout plans, personal training
6. Progress tracking
7. Reports and announcements

We can reorder this freely — it's your call, and the sequence above is just the
one where each step is useful on its own before the next one lands.
