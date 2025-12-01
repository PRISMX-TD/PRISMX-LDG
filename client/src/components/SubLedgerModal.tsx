import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Palette, BookOpen, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SubLedger } from "@shared/schema";

interface SubLedgerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subLedger?: SubLedger | null;
}

const COLORS = [
  "#8B5CF6", "#A78BFA", "#7C3AED", "#6D28D9",
  "#10B981", "#34D399", "#059669", "#047857",
  "#3B82F6", "#60A5FA", "#2563EB", "#1D4ED8",
  "#F59E0B", "#FBBF24", "#D97706", "#B45309",
  "#EF4444", "#F87171", "#DC2626", "#B91C1C",
  "#EC4899", "#F472B6", "#DB2777", "#BE185D",
];

const ICONS = [
  { value: "trip", label: "旅行" },
  { value: "project", label: "项目" },
  { value: "event", label: "活动" },
  { value: "wedding", label: "婚礼" },
  { value: "renovation", label: "装修" },
  { value: "education", label: "教育" },
  { value: "business", label: "业务" },
  { value: "other", label: "其他" },
];

export function SubLedgerModal({ open, onOpenChange, subLedger }: SubLedgerModalProps) {
  const { toast } = useToast();
  const isEditing = !!subLedger;
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("trip");
  const [color, setColor] = useState("#8B5CF6");
  const [includeInMainAnalytics, setIncludeInMainAnalytics] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (subLedger) {
      setName(subLedger.name);
      setDescription(subLedger.description || "");
      setIcon(subLedger.icon || "trip");
      setColor(subLedger.color || "#8B5CF6");
      setIncludeInMainAnalytics(subLedger.includeInMainAnalytics ?? true);
      setStartDate(subLedger.startDate ? new Date(subLedger.startDate).toISOString().split("T")[0] : "");
      setEndDate(subLedger.endDate ? new Date(subLedger.endDate).toISOString().split("T")[0] : "");
    } else {
      setName("");
      setDescription("");
      setIcon("trip");
      setColor("#8B5CF6");
      setIncludeInMainAnalytics(true);
      setStartDate("");
      setEndDate("");
    }
  }, [subLedger, open]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sub-ledgers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      toast({ title: "子账本创建成功" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "创建失败", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sub-ledgers/${subLedger?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      toast({ title: "子账本更新成功" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "更新失败", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "请输入名称", variant: "destructive" });
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      icon,
      color,
      includeInMainAnalytics,
      startDate: startDate || null,
      endDate: endDate || null,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {isEditing ? "编辑子账本" : "创建子账本"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              placeholder="例如: 日本旅行"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-subledger-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              placeholder="添加一些描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              data-testid="input-subledger-description"
            />
          </div>

          <div className="space-y-2">
            <Label>类型</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={icon === item.value ? "default" : "outline"}
                  onClick={() => setIcon(item.value)}
                  data-testid={`button-icon-${item.value}`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              颜色
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`button-color-${c.replace("#", "")}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                开始日期
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-subledger-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                结束日期
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-subledger-end-date"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label htmlFor="includeInMain" className="cursor-pointer">计入总账分析</Label>
              <p className="text-xs text-muted-foreground">
                关闭后，此子账本的交易不会出现在主数据分析中
              </p>
            </div>
            <Switch
              id="includeInMain"
              checked={includeInMainAnalytics}
              onCheckedChange={setIncludeInMainAnalytics}
              data-testid="switch-include-in-main"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-subledger"
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isPending}
              data-testid="button-save-subledger"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "保存" : "创建"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
