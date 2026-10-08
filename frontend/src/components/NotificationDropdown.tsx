import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { notificationApi } from "@/services/api";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  relatedBookId: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationDropdown() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    loadNotifications();
  }, [isAuthenticated, user]);

  const loadNotifications = async () => {
    try {
      const notificationsRes = await notificationApi.getNotifications();
      // Only show unread notifications in the dropdown
      const unread = notificationsRes.data
        ?.filter((n: Notification) => !n.isRead)
        .sort((a: Notification, b: Notification) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      setNotifications(unread || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }

    try {
      const countRes = await notificationApi.getUnreadCount();
      setUnreadCount(countRes.data?.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      // Remove only this notification from the visible list
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      // Recalculate unread count from remaining notifications
      setUnreadCount((prev) => {
        const remainingUnread = notifications.filter((n) => !n.isRead).length;
        return Math.max(0, remainingUnread);
      });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      // Hide all notifications from the dropdown
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markAsRead(notif._id);
    }
    navigate(`/book/${notif.relatedBookId}`);
    setOpen(false);
  };

  // Only show notifications for non-admin users
  if (user?.isAdmin) {
    return <></>;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 flex items-center justify-center relative"
        >
          <Bell className="h-5 w-5 text-primary" />
          {unreadCount > 0 && (
            <Badge
              className="absolute top-1 right-1 h-2 w-2 bg-primary text-primary-foreground rounded-full text-xs"
            >
              {unreadCount > 99 ? "+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <span className="text-xs text-muted-foreground">
              {unreadCount} unread
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {unreadCount === 0 ? "All notifications read" : "No notifications"}
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem
                key={notif._id}
                className={`
                  flex flex-col items-start p-3 cursor-pointer
                  ${notif.isRead ? "" : "bg-primary/5"}
                `}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`
                    text-sm font-medium text-foreground
                    ${notif.isRead ? "" : "font-bold"}
                  `}>
                    {notif.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {notif.message}
                </p>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
          className="justify-center text-sm"
        >
          {unreadCount > 0 ? "Mark all as read" : "No actions"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}