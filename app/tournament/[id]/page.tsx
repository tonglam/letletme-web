import { generateStaticParams } from "./staticParams";
import TournamentDetailClient from "./TournamentDetailClient";

export { generateStaticParams };

export default function Page({ params }: { params: { id: string } }) {
  return <TournamentDetailClient params={params} />;
}