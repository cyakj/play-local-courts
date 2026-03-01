import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, HelpCircle, FileText, Shield, ExternalLink, ChevronRight } from 'lucide-react';

const links = [
  {
    icon: Mail,
    label: 'Contact Us',
    desc: 'Get in touch with our support team',
    href: 'mailto:support@playlocalcourts.com',
    external: true,
  },
  {
    icon: HelpCircle,
    label: 'FAQ',
    desc: 'Frequently asked questions',
    href: '/faq',
    external: false,
  },
  {
    icon: FileText,
    label: 'Terms of Service',
    desc: 'Read our terms and conditions',
    href: '/terms',
    external: false,
  },
  {
    icon: Shield,
    label: 'Privacy Policy',
    desc: 'How we handle your data',
    href: '/privacy',
    external: false,
  },
];

const HelpSupportSection: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Help & Support</CardTitle>
        <CardDescription>Get help, review policies, and contact our team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {links.map(({ icon: Icon, label, desc, href, external }) => (
          <a
            key={label}
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-xl">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
            {external ? (
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            )}
          </a>
        ))}
      </CardContent>
    </Card>
  );
};

export default HelpSupportSection;
