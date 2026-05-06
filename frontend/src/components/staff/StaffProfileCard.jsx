import { staffAvatarInitials, staffWelcomeDisplayName } from "../../utils/avatarInitials.js";
import StaffProfileAvatar from "../shared/StaffProfileAvatar.jsx";

export default function StaffProfileCard({ staffProfileLoading, staffMe }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <StaffProfileAvatar
          imageUrl={staffMe?.avatar_url}
          initials={staffAvatarInitials(staffMe?.username, staffMe?.email)}
          sizeClass="h-16 w-16 sm:h-20 sm:w-20"
          textClass="text-lg sm:text-2xl"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            <span className="font-semibold text-slate-400">مرحبًا، </span>
            <span className="text-white">
              {staffProfileLoading && !staffMe?.email
                ? "…"
                : staffWelcomeDisplayName(staffMe?.username, staffMe?.full_name, staffMe?.email)}
            </span>
          </h2>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">سجلات الأطباق الخاصة بك</p>
          {staffMe?.email ? (
            <p className="mt-1.5 break-all text-xs text-slate-500 sm:text-sm" dir="ltr">
              {staffMe.email}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">الفرع: {staffMe?.branch_name || "فرع تجريبي"}</p>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">المشرف: {staffMe?.supervisor_name || "supervisor"}</p>
        </div>
      </div>
      <p className="shrink-0 text-xs text-slate-500 sm:text-sm">لوحة الموظف · SKA</p>
    </div>
  );
}
