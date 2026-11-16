import {requirePage} from "@/lib/page-auth";
import IntakeForm from "@/components/IntakeForm";
export default async function NewIntake(){
 const user=await requirePage("foster");
 return <main className="page-shell max-w-3xl space-y-6 py-8"><h1 className="text-3xl font-bold">Report a found pet</h1>{user.isApproved?<IntakeForm/>:<p>Your foster account must be approved by staff first.</p>}</main>;
}
