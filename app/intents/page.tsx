import { redirect } from "next/navigation";

export default function IntentsPage() {
  redirect("/projects?tab=buying");
}
