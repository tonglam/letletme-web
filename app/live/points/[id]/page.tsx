import { Metadata } from "next";
import { generateStaticParams } from "./staticParams";
import TeamPointsClient from "./TeamPointsClient";

export { generateStaticParams };

export default function Page({ params }: { params: { id: string } }) {
  return <TeamPointsClient params={params} />;
}