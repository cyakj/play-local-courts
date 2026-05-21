
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Navy brand tokens
				navy: {
					DEFAULT: 'hsl(var(--navy))',
					mid: 'hsl(var(--navy-mid))',
					light: 'hsl(var(--navy-light))',
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					bg: 'hsl(var(--success-bg))',
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					bg: 'hsl(var(--warning-bg))',
				},
				danger: {
					DEFAULT: 'hsl(var(--danger))',
					bg: 'hsl(var(--danger-bg))',
				},
				'cyan-light': 'hsl(var(--cyan-light))',
				'text-mid': 'hsl(var(--text-mid))',
				// Custom colors for the app
				court: {
					available: '#4CAF50',
					booked: '#F44336',
					maintenance: '#FFC107'
				},
				compete: {
					DEFAULT: 'hsl(var(--compete))',
					foreground: 'hsl(var(--compete-foreground))',
					light: 'hsl(var(--compete-light))',
					muted: 'hsl(var(--compete-muted))'
				},
				// Condo Manager brand tokens
				'cm-navy': 'hsl(var(--cm-navy))',
				'cm-navy-mid': 'hsl(var(--cm-navy-mid))',
				'cm-navy-light': 'hsl(var(--cm-navy-light))',
				'cm-cyan': 'hsl(var(--cm-cyan))',
				'cm-cyan-light': 'hsl(var(--cm-cyan-light))',
				'cm-app-bg': 'hsl(var(--cm-app-bg))',
				'cm-text': 'hsl(var(--cm-text))',
				'cm-text-mid': 'hsl(var(--cm-text-mid))',
				'cm-text-light': 'hsl(var(--cm-text-light))',
				'cm-border': 'hsl(var(--cm-border))',
				'cm-success': 'hsl(var(--cm-success))',
				'cm-success-bg': 'hsl(var(--cm-success-bg))',
				'cm-warning': 'hsl(var(--cm-warning))',
				'cm-warning-bg': 'hsl(var(--cm-warning-bg))',
				'cm-danger': 'hsl(var(--cm-danger))',
				'cm-danger-bg': 'hsl(var(--cm-danger-bg))'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
