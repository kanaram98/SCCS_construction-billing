/** Injects `@page` rules so browser printing matches the chosen paper, margins and page numbers. */
export default function PrintPageStyle({ settings }) {
  const pageNumbers = settings.pageNumbers
    ? '@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:8pt;}'
    : '';
  return (
    <style>
      {`@media print{@page{size:${settings.paper} ${settings.orientation};margin:${settings.margin}mm;${pageNumbers}}}`}
    </style>
  );
}
