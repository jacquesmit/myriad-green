Trends Widget — Integration Guide

Purpose

The Trends widget provides market intelligence and is intentionally opt-in to avoid leaking competitive data on product or sensitive pages.

How to enable on a page

1) Add a mount element where you want the widget to appear. Example:

   <section class="section--trends">
     <div class="trends__mount" id="trends-widget"></div>
   </section>

2) Or add an opt-in attribute to <body> or <html> when you want the widget to auto-mount into a default location:

   <body data-has-trends="true">

3) Server-rendered/static container detection: if you render a server-side container with id `trends-widget-container` it will be used as the mount.

Dark / Light mode compatibility

- The widget respects the `data-theme` attribute on the `<html>` element. Use `data-theme="dark"` to set a page dark theme.
- The widget also listens to the user's OS color-scheme via `prefers-color-scheme` and will update dynamically.
- Use CSS variables to control colors (see `css/trends-widget.css`) — for example set `--color-card-bg`, `--color-text`, `--color-accent`, `--color-border`.

Hiding the widget for competitive or admin purposes

Server-side hidden containers

- Pages may render the trends section markup for SEO and layout but intentionally hide the interactive widget from public visitors using the `trends__widget-container--hidden` class and `aria-hidden="true"`. This preserves the three insight cards visible to users while keeping the interactive data source concealed.

Admin / Debug overrides

- To view the interactive widget on pages that are hidden server-side use one of these admin overrides:
   - Add `?admin=true` to the page URL
   - Set `localStorage.setItem('showTrendsForAdmin','true')` in the console
   - Global disable for development: `localStorage.setItem('disableTrendsWidget','true')` (prevents widget entirely)

The JS initialization will skip interactive widget setup if the page has a hidden server-rendered trends container and no admin override is present.

Notes

- The widget will not auto-initialize on pages that do not explicitly include a mount point or opt-in flag. This prevents accidental injections on product pages.
- If you need the widget on product pages, add the `data-has-trends="true"` flag to the page or include the `#trends-widget` mount element.
