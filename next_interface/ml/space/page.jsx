import BotSpaceClient from "./BotSpaceClient";

export const metadata = {
  title: "Bot Space 3D | HeyMarco",
  description:
    "Visualizacion 3D de clusters ML para explorar labels, user agents e IPs que visitan Edunautica.",
};

export default function MlSpacePage() {
  return <BotSpaceClient />;
}
