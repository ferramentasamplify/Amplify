import { redirect } from "next/navigation";

export default function AmIndex() {
  // Leva o usuário pra tela de login; depois do login, o login redireciona pra carteira
  redirect("/club/am/login?next=/club/am");
}