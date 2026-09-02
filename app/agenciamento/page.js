import WhatsAppLauncher from "./WhatsAppLauncher";

export const metadata = {
  title: "Faça parte da Amplify",
  description: "Fale com o time de Aquisição da Amplify pelo WhatsApp.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AgenciamentoPage() {
  return <WhatsAppLauncher />;
}
