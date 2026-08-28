# Who Has This Pain — Consolidated

Merged from three passes. The first attempt (`agent-1-ATTEMPT-1-superseded.md`) returned 3
findings and reached no consumer forum at all. Two retry agents then broke the block:

- `agent-1a-pain-reddit-forums.md` — 6 findings, Reddit reached via the pullpush.io archive API
- `agent-1b-pain-complaints-regulators.md` — 9 findings, mostly CFPB complaint narratives
- `agent-1-ATTEMPT-1-superseded.md` — 3 findings, Hacker News only

**18 sourced findings total, every one with a public URL.** Organised below by document type,
which is what matters for deciding what Redline ingests first.

**One sourcing caveat that applies to every CFPB quote.** They were retrieved through WebFetch,
which caps any single verbatim extract at roughly 125 characters. Each quote is verbatim
*within that sentence*; none is confirmation of the full narrative's wording. Treat them as
accurate short quotes, not as verified full complaints.

---

## Residential leases

**1. Renewal quietly shifted appliance-repair liability onto the tenant**
> "He said he'd pay for the service, but he said that moving forward with the lease renewal, there will be a clause that says appliances are left as a courtesy, and it will be tenants' responsibility to repair/replace appliances in the future."

https://www.reddit.com/r/Tenant/comments/1ki0xvd/ca_lease_renewal_now_has_clause_appliances_not/

The new lease is materially worse than the old one and the change is a single sentence. A diff
against the previously signed version would catch this; a one-document review would not.

**2. Signed first, then asked strangers to interpret her own contract**
> "So I just signed my lease agreement; and I notice that the document does not have an early term clause"

She then pastes her lease's actual default clause, which is what she was really facing:
> "Tenant shall be responsible for all rent due for the balance of the Lease term, even though Tenant may no longer be able to live in or use the Premises due to the eviction."

https://www.reddit.com/r/Tenant/comments/1kfccmc/renting_from_a_private_landlord_no_early/

The closest thing in this research to a person manually performing Redline's job on themselves —
and doing it *after* signing.

**3. Surprise fee she could only contest by rereading the clause**
> "The early termination clause states the additional fee equal to one month's rent is for re-leasing costs, which should include 'cleaning' if they feel it's necessary"

https://www.reddit.com/r/Tenant/comments/1kd3f8f/unreasonable_fees/

## Subscriptions, gyms, and ToS auto-renewal

**4.** > "I signed a 6 month contract with a gym. it ended in February and it auto renewed my membership. In the contract it states that it auto renews unless written notice is given 10 days prior."

https://www.reddit.com/r/legaladvice/comments/1k80p7d/gym_automatic_membership_renewal/

**5.** > "There are no options online to cancel, no notifications of auto renewal, and the gym is telling her to cancel in person or email."

https://www.reddit.com/r/legaladvice/comments/1k73akb/gym_membership_auto_renewal/

**6.** > "Kikoff automatically renewed my subscription without my consent (see screenshot of emails from Kikoff-no mention of auto renewal)"

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/9460812

**7.** > "PayPal authorized a three year auto-renewal to a magazine subscription."

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/3626468

**8. Regulator narrative (not a consumer quote)** — FTC v. LA Fitness:
> "Consumers who try to cancel their memberships by stopping charges to their bank or credit card find they are rebilled, often under new account numbers."

https://www.ftc.gov/news-events/news/press-releases/2025/08/ftc-sues-la-fitness-making-it-difficult-consumers-cancel-gym-memberships

Findings 4–8 share a shape: the harm is a **missed deadline stated once**, not dense legalese.
Extracting "the dates and notice windows that bind you" is a distinct feature from clause risk-ranking.

## Freelance and contractor agreements

**9. Caught a liability-shifting clause — but only by reading closely**
> "I was startled to read that if I didn't complete the three year job for their client for any reason I would be liable for any and all expenses related to completing the job. ... That was a total WTF clause as far as I was concerned and I had them strike it out, which they did after a bit of hemming and hawing."

https://news.ycombinator.com/item?id=1794718

The counterfactual case, and the best single argument for the counter-offer feature: he found it,
pushed back, and won. Most people don't do the reading.

**10. Doing unpaid legal analysis, and afraid to raise it**
> "I am a little uncomfortable with some of the language in sections 2.1 & 2.2 ... This language seems quite broad and what constitutes 'Community Code' seems a bit difficult to define."

On why pushing back is hard:
> "personally I wanted the first impression I left to be that I'm a 'team player,' as opposed to starting a legal battle on day one."

https://news.ycombinator.com/item?id=13544336

The barrier is not only comprehension. It is having credible language to send back.

## Employment contracts and non-competes

**11.** > "I don't remember exactly signing a noncompete, because there are a lot of forms you have to sign when you get hired." — Joby George

https://www.npr.org/2023/01/13/1148446019/ftc-rule-ban-noncompetes-low-wage-workers-trade-secrets

**12.** > "Yes, hindsight is a wonderful thing - I signed this 3.5 years ago fresh out of university and didn't pay enough attention to the small print, I realise that now."

https://news.ycombinator.com/item?id=3872252

## Financial and services contracts

**13. The most direct statement of the core pain found anywhere**
> "My wife and I signed documents that we did not understand we really need some help"

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/11244754

**14. Rushed past the fine print**
> "The fact that the fees are hidden in the contract plus being rushed to sign did not allow me the opportunity to make an informed decision before signing the contract."

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/6741125

**15. Arbitration opt-out never disclosed**
> "I was not informed that I had the right to opt-out or decline the arbitration clause."

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/9073594

**16. The terms changed between offer and enforcement**
> "The fine print they sent me in their denial email is not the fine print that was on the offer page"

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/2319975

**17.** > "This is plain false advertising and needs to be stopped." (auto-renewal presented as optional)

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/6965230

**18. Bound by terms added after agreeing**
> "Right off the bat, they assert the arbitration clause applied to everything, even though it plainly didn't. I had to give the judge a copy of the first terms of services that clearly show that the arbitration clause was not there for the first few transactions."

https://news.ycombinator.com/item?id=17558763 — reproducing now-dead Motherboard/Vice reporting.
The HN reproduction is the only verifiable record; treat as lower-confidence.

---

## What we still could not find

- **No freelancer describing a specific clause that actually cost them money.** Findings 9 and 10
  are both near-misses — people who caught the problem. Freelancers Union has aggregate stats
  (avg $5,968/yr lost) but no quotable first-person testimony was reachable. This matters:
  freelancers are the strongest willingness-to-pay segment, and we have the weakest pain voice for them.
- **No small-business vendor/SaaS contract story.** Every pullpush attempt at r/smallbusiness hit
  the rate limit.
- **Reddit comment threads were never reached** — only original post text. The advice *under* these
  posts is likely richer than the posts themselves.
- Subreddits never reached: r/LegalAdviceUK, r/personalfinance, r/AskALawyer, r/consulting, r/gigwork.

## Access notes for any future run

- **Reddit:** WebSearch returns zero reddit.com results ever; WebFetch refuses reddit domains outright;
  direct curl gets 403 at the WAF; r.jina.ai relays the block page. **Only pullpush.io works**, and it
  is aggressively rate-limited (~1 success per 15 attempts). Budget time, not retries.
- **CFPB:** the opposite pattern — curl is Akamai-blocked, WebFetch succeeds.
  `consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?search_term=X&field=complaint_what_happened&size=10&no_aggs=true`
  The old Socrata dataset ID is dead. Ask WebFetch for "one verbatim sentence under 120 characters."
- **ftc.gov and npr.org:** curl with a browser User-Agent works; WebFetch gets 403.
- Not retried this round: Avvo, JustAnswer, ConsumerAffairs, Quora, Trustpilot, BBB — unexplored, not confirmed blocked.
