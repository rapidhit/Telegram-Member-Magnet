import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Book, HelpCircle, LifeBuoy, Bug } from "lucide-react";

export function HelpSupport() {
  const supportItems = [
    {
      icon: <Book className="h-4 w-4 text-[hsl(207,90%,54%)]" />,
      label: "Documentation",
      onClick: () => window.open("https://core.telegram.org/api", "_blank"),
    },
    {
      icon: <HelpCircle className="h-4 w-4 text-[hsl(207,90%,54%)]" />,
      label: "FAQ",
      onClick: () => {},
    },
    {
      icon: <LifeBuoy className="h-4 w-4 text-[hsl(207,90%,54%)]" />,
      label: "Contact Support",
      onClick: () => window.open("https://t.me/tele_magnet_bot", "_blank"),
    },
    {
      icon: <Bug className="h-4 w-4 text-[hsl(207,90%,54%)]" />,
      label: "Report Issue",
      onClick: () => window.open("https://t.me/tele_magnet_bot", "_blank"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Help & Support
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {supportItems.map((item, index) => (
          <Button
            key={index}
            variant="ghost"
            className="w-full justify-start p-3"
            onClick={item.onClick}
          >
            {item.icon}
            <span className="ml-3 text-sm font-medium text-gray-700">
              {item.label}
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
