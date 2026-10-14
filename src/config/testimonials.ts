// Edit this list to swap in real customer testimonials.
// Rendered on the auth shell rail (login/signup/etc).
export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "SalesOS quietly runs in the background — research, drafts, follow-ups — so my team can focus on the conversations that actually move revenue.",
    name: "Jordan Reyes",
    role: "Head of Revenue, Placeholder Co.",
    initials: "JR",
  },
];

export function getPrimaryTestimonial(): Testimonial {
  return testimonials[0];
}
