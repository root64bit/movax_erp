# Mobile responsive architecture

The application shell uses a fixed desktop sidebar from 1024px and an off-canvas drawer below it. The drawer closes after navigation or Escape and locks background scrolling. Forms collapse to one column, controls use a 44px minimum touch target, wide operational tables use bounded horizontal containers, and modals have viewport-bounded scrolling.

Print output is isolated through `@media print` with A4 margins, hidden navigation/chrome, and row page-break protection.
