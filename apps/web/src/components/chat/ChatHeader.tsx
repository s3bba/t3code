import {
  type EditorId,
  type ProjectDevShell,
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type ThreadId,
  type WorkspaceDevShellEvent,
} from "@t3tools/contracts";
import { memo } from "react";
import GitActionsControl from "../GitActionsControl";
import { DiffIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { Toggle } from "../ui/toggle";
import { SidebarTrigger } from "../ui/sidebar";
import { OpenInPicker } from "./OpenInPicker";
import { Spinner } from "../ui/spinner";
import { cn } from "~/lib/utils";

interface ChatHeaderProps {
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  activeProjectDevShell: ProjectDevShell | undefined;
  activeWorkspaceDevShellEvent: WorkspaceDevShellEvent | null;
  isGitRepo: boolean;
  openInCwd: string | null;
  activeProjectScripts: ProjectScript[] | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  diffToggleShortcutLabel: string | null;
  gitCwd: string | null;
  diffOpen: boolean;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  onUpdateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  onDeleteProjectScript: (scriptId: string) => Promise<void>;
  onToggleProjectDevShell: () => void;
  onToggleDiff: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadId,
  activeThreadTitle,
  activeProjectName,
  activeProjectDevShell,
  activeWorkspaceDevShellEvent,
  isGitRepo,
  openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  availableEditors,
  diffToggleShortcutLabel,
  gitCwd,
  diffOpen,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onToggleProjectDevShell,
  onToggleDiff,
}: ChatHeaderProps) {
  const isNixDevShellEnabled = activeProjectDevShell?.kind === "nix-flake";
  const isPreparingWorkspaceDevShell = activeWorkspaceDevShellEvent?.type === "loading";
  const workspaceDevShellErrorMessage =
    activeWorkspaceDevShellEvent?.type === "error" ? activeWorkspaceDevShellEvent.message : null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
        <h2
          className="min-w-0 shrink truncate text-sm font-medium text-foreground"
          title={activeThreadTitle}
        >
          {activeThreadTitle}
        </h2>
        {activeProjectName && (
          <Badge variant="outline" className="min-w-0 shrink truncate">
            {activeProjectName}
          </Badge>
        )}
        {activeProjectName && !isGitRepo && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700">
            No Git
          </Badge>
        )}
      </div>
      <div className="@container/header-actions flex min-w-0 flex-1 items-center justify-end gap-2 @sm/header-actions:gap-3">
        {activeProjectScripts && (
          <ProjectScriptsControl
            scripts={activeProjectScripts}
            keybindings={keybindings}
            preferredScriptId={preferredScriptId}
            onRunScript={onRunProjectScript}
            onAddScript={onAddProjectScript}
            onUpdateScript={onUpdateProjectScript}
            onDeleteScript={onDeleteProjectScript}
          />
        )}
        {activeProjectName && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  className={cn("shrink-0 gap-1 px-2 text-[11px]", {
                    "border-blue-600 bg-blue-600 hover:bg-blue-500": isNixDevShellEnabled,
                    "border-amber-500/60 text-amber-700": workspaceDevShellErrorMessage,
                  })}
                  pressed={isNixDevShellEnabled}
                  onPressedChange={onToggleProjectDevShell}
                  aria-label={
                    isPreparingWorkspaceDevShell
                      ? "Preparing nix flake dev shell"
                      : isNixDevShellEnabled
                        ? "Disable nix flake dev shell"
                        : "Enable nix flake dev shell"
                  }
                  variant="outline"
                  size="xs"
                  disabled={isPreparingWorkspaceDevShell}
                >
                  {isPreparingWorkspaceDevShell ? <Spinner className="size-3" /> : null}
                  Nix
                </Toggle>
              }
            />
            <TooltipPopup side="bottom">
              {isPreparingWorkspaceDevShell
                ? "Preparing nix flake dev shell..."
                : workspaceDevShellErrorMessage
                  ? workspaceDevShellErrorMessage
                  : isNixDevShellEnabled
                    ? "Disable the cached flake dev shell for terminal and agent sessions"
                    : "Enable the cached flake dev shell for terminal and agent sessions"}
            </TooltipPopup>
          </Tooltip>
        )}
        {activeProjectName && (
          <OpenInPicker
            keybindings={keybindings}
            availableEditors={availableEditors}
            openInCwd={openInCwd}
          />
        )}
        {activeProjectName && <GitActionsControl gitCwd={gitCwd} activeThreadId={activeThreadId} />}
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                className="shrink-0"
                pressed={diffOpen}
                onPressedChange={onToggleDiff}
                aria-label="Toggle diff panel"
                variant="outline"
                size="xs"
                disabled={!isGitRepo}
              >
                <DiffIcon className="size-3" />
              </Toggle>
            }
          />
          <TooltipPopup side="bottom">
            {!isGitRepo
              ? "Diff panel is unavailable because this project is not a git repository."
              : diffToggleShortcutLabel
                ? `Toggle diff panel (${diffToggleShortcutLabel})`
                : "Toggle diff panel"}
          </TooltipPopup>
        </Tooltip>
      </div>
    </div>
  );
});
