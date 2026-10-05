import {
  Activity, Archive, ArchiveRestore, ArrowLeft, Ban, Bell, Bot, Boxes, Brain, Building2, ChevronDown, ChevronRight, CircleAlert, CircleCheck,
  CircleHelp, CirclePlay, Clock, Code, Copy, Database, Download, Ellipsis, ExternalLink, Eye, File, FileText, Filter, Folder, FolderOpen,
  Gauge, GitCompare, GitMerge, GitPullRequest, History, House, Inbox, Info, KeyRound, Keyboard, Layers, Link, ListTree, Lock, LogIn, LogOut,
  Mail, Menu, Monitor, Moon, Network, Pause, Pin, Play, Plug, Plus, Receipt, RefreshCw, RotateCcw, Save, ScrollText, Search, Settings,
  Shield, ShieldCheck, SlidersHorizontal, Square, Sun, Terminal, Trash2, TriangleAlert, Unplug, Upload, UserCog, Users, Workflow, X,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  home: House, 'file-text': FileText, code: Code, bot: Bot, boxes: Boxes, workflow: Workflow, 'play-circle': CirclePlay, 'shield-check': ShieldCheck,
  brain: Brain, 'key-round': KeyRound, users: Users, settings: Settings, 'user-cog': UserCog, 'building-2': Building2, receipt: Receipt,
  monitor: Monitor, eye: Eye, link: Link, search: Search, sun: Sun, moon: Moon, help: CircleHelp, menu: Menu, close: X, 'chevron-right': ChevronRight,
  'chevron-down': ChevronDown, info: Info, warning: TriangleAlert, danger: CircleAlert, success: CircleCheck, lock: Lock, plug: Plug, unplug: Unplug,
  refresh: RefreshCw, download: Download, upload: Upload, plus: Plus, folder: Folder, 'folder-open': FolderOpen, file: File, history: History,
  compare: GitCompare, archive: Archive, restore: ArchiveRestore, copy: Copy, save: Save, trash: Trash2, pin: Pin, external: ExternalLink,
  sliders: SlidersHorizontal, keyboard: Keyboard, tree: ListTree, clock: Clock, back: ArrowLeft, filter: Filter, more: Ellipsis, activity: Activity,
  terminal: Terminal, pr: GitPullRequest, merge: GitMerge, database: Database, gauge: Gauge, layers: Layers, network: Network, play: Play,
  pause: Pause, stop: Square, retry: RotateCcw, ban: Ban, scroll: ScrollText, inbox: Inbox, bell: Bell, login: LogIn, logout: LogOut, mail: Mail, shield: Shield,
};

export function Icon({ name, label, size = 16, className }: { name: string; label?: string; size?: number; className?: string }) {
  const C = MAP[name] ?? Info;
  return <C width={size} height={size} className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} focusable="false" />;
}
