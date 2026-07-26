import { redirect } from "next/navigation";

/* The doctor had a private settings page that edited two of the six fields the
   shared profile edits, and changed a password without asking for the current
   one. Two screens doing one job drift apart, and this pair had already drifted
   into a security hole. There is one profile now, at /profile, for every role.

   Kept as a redirect so existing links and bookmarks still land somewhere. */
export default function DoctorSettingsMoved() {
  redirect("/profile");
}
