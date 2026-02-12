---
description: codereview workflow
---

# Antigravity Agent Workflow: Code Review Protocol

**Protocol ID:** AG-CR-001
**Role:** Reviewer Agent
**Objective:** Maintain code health and ensure system stability through rigorous peer review.
**Based on:** [Google Engineering Practices](https://google.github.io/eng-practices/review/reviewer/)

---

## 🟢 Phase 1: Initiation & Triage (The "Speed" Check)

**Trigger:** You receive a notification requesting a review.

1.  **Check Availability:**
    * *Rule:* Code reviews have high priority. Speed matters.
    * **IF** you are in a "Deep Focus" state on your own critical task:
        * **THEN:** Schedule the review for a specific time later today.
    * **IF** you are not in "Deep Focus":
        * **THEN:** Start the review immediately.

2.  **Context Check:**
    * Read the CL (Change List) description.
    * **Decision Gate:**
        * [ ] Is the description clear?
        * [ ] Does it explain *why* this change is necessary?
        * **IF NO:** Stop. Comment requesting a better description. Do not review the code yet.

---

## 🔵 Phase 2: High-Level Scan (The "Design" Check)

**Goal:** Prevent wasted effort on fundamentally flawed approaches.

1.  **Inspect the Architecture:**
    * Do not look at typos or style yet. Look at the file list and the "Main" logic file.
    * **Question:** Does this design make sense?
    * **Question:** Does it belong in this part of the system?
    * **Question:** Is it compatible with existing Antigravity patterns?

2.  **The "Stop" Protocol:**
    * **IF** the design is flawed or the approach is wrong:
        * **ACTION:** Stop reviewing immediately.
        * **OUTPUT:** Write a high-level comment explaining the architectural objection.
        * **RESULT:** Send back to Author Agent. (End of Workflow until resubmission).

    * **IF** the design is solid:
        * **ACTION:** Proceed to Phase 3.

---

## 🟣 Phase 3: The Deep Dive (The "Logic" Loop)

**Execution Strategy:** Review the most important file first, then the supporting files.

### Step 3.1: Analyze the Core Logic
*Locate the primary file where the logic lives.*

* **[ ] Complexity Check:**
    * Is the code simple?
    * **Rule:** Reject over-engineering. If a standard library function exists, the Agent must use it.
* **[ ] Functionality Check:**
    * Does it actually handle the requirements?
    * Are there hidden bugs (race conditions, edge cases, null pointers)?
* **[ ] Comprehension Check:**
    * Can you understand the code *without* reading the explanation? If not, the code needs refactoring or comments.

### Step 3.2: Analyze the Tests
*Locate the test files.*

* **[ ] Existence:** Are there tests?
* **[ ] Validity:** Do the tests fail if the code is broken? (Beware of false positives).
* **[ ] Quality:** Is the test code clean and readable?

### Step 3.3: Analyze the "Glue"
*Check headers, configurations, and helper files.*

* **[ ] Naming:** Are variables named descriptively? (e.g., `user_account_id` vs `id`).
* **[ ] Comments:** Do comments explain *WHY*, not *WHAT*?
* **[ ] Style:** Does it match the Style Guide? (Use an automated linter where possible, don't waste human cycles on whitespace unless critical).

---

## 🟠 Phase 4: Feedback Generation (The "Communication" Protocol)

**Goal:** Provide actionable, polite, and clear feedback.

1.  **Drafting Comments:**
    * **Critical Issues:** Mark as blocking. Explain the risk.
    * **Minor Issues:** Prefix with `Nit:` (e.g., `Nit: Consider renaming this for clarity`). This tells the Author Agent it is optional.
    * **Praise:** If a solution is elegant, leave a comment: *"Good approach here."*

2.  **The "Standard" Test:**
    * Before hitting submit, ask: *"Is the code significantly better than before, even if not perfect?"*
    * **IF** Yes **AND** no critical bugs exist:
        * **THEN:** You must not block approval for minor "nits".

---

## 🔴 Phase 5: Iteration & Closure

1.  **Submit Review:**
    * Select: `Request Changes` (if blocking bugs/design issues exist) OR `Comment` (if questions remain).

2.  **Re-Review (Loop):**
    * When the Author Agent updates the code:
    * Focus *only* on the changes and their side effects.
    * Do not re-litigate issues you already accepted (unless new changes broke them).

3.  **Final Approval:**
    * **Condition:** All critical comments resolved.
    * **Action:** Click `Approve` (LGTM - Looks Good To Me).
    * **Post-Action:** You are now co-responsible for this code.

---
*Workflow Complete.*