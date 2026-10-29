# FeedbackForm

The complete “Give Fast Feedback” modal from the brief: rating scale, optional email, message (Markdown supported), anonymous specs checkbox, Cancel / Submit Feedback, and a thank-you state.

**Provide** `onSubmit(data)` — receives `{ rating, email, message, includeSpecs }` — and `onClose`. The host posts `data` to the secure webhook.

- Opened from “Provide Feedback” in the nav and “Give Fast Feedback” buttons, on any page.
- Never mention GitHub or issues in the UI; the confirmation says “We read every note”.
- The thank-you state replaces the form; “Back to CacheDrop” calls `onClose`.
