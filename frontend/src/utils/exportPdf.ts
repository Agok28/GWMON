import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type {
  TrafficFilters,
  TrafficSummaryResponse,
  TopEndpointsResponse,
  ProtocolDistributionResponse,
  ProtocolOption,
} from '../types/traffic';
import type {
  Alert,
  AlertsSummary,
  TopSignature,
} from '../types/alerts';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function severityLabel(sev: number | null | undefined): string {
  if (sev === 1) return 'CRITICAL';
  if (sev === 2) return 'HIGH';
  if (sev === 3) return 'MEDIUM';
  if (sev !== null && sev !== undefined && sev >= 4) return 'LOW';
  return 'UNKNOWN';
}

export interface TopAttacker {
  ip: string;
  count: number;
}

interface ExportData {
  filters: TrafficFilters;
  summary: TrafficSummaryResponse | null;
  topSources: TopEndpointsResponse | null;
  topDestinations: TopEndpointsResponse | null;
  protocolDist: ProtocolDistributionResponse | null;
  protocols: ProtocolOption[];
  alertsSummary?: AlertsSummary | null;
  topSignatures?: TopSignature[] | null;
  latestAlert?: Alert | null;
  topAttacker?: TopAttacker | null;
  alertsAvailable?: boolean;
}

export function exportDashboardPdf(data: ExportData) {
  const {
    filters,
    summary,
    topSources,
    topDestinations,
    protocolDist,
    protocols,
    alertsSummary,
    topSignatures,
    latestAlert,
    topAttacker,
    alertsAvailable = true,
  } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const startDate = format(new Date(filters.start), 'yyyy-MM-dd HH:mm');
  const stopDate = format(new Date(filters.stop), 'yyyy-MM-dd HH:mm');
  const protoLabel = filters.proto
    ? protocols.find((p) => p.proto === filters.proto)?.label ?? `Proto ${filters.proto}`
    : 'All';

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GWMON Traffic Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Report metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Filters section
  doc.setDrawColor(200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, pageWidth - 28, 28, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60);
  doc.text('ACTIVE FILTERS', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  const filterLines = [
    `Time Range: ${startDate}  →  ${stopDate}`,
    `Protocol: ${protoLabel}` +
      (filters.src_ip ? `    |    Source IP: ${filters.src_ip}` : '') +
      (filters.dst_ip ? `    |    Dest IP: ${filters.dst_ip}` : ''),
  ];
  doc.text(filterLines[0], 20, y + 14);
  doc.text(filterLines[1], 20, y + 20);
  y += 36;

  // Summary stats
  if (summary) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Summary', 14, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Total Traffic', formatBytes(summary.total_bytes)],
        ['Total Packets', formatNumber(summary.total_packets)],
        ['Total Flows', formatNumber(summary.total_flows)],
        ['Data Points', formatNumber(summary.points.length)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 195, 247], textColor: [13, 17, 23], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Protocol distribution
  if (protocolDist && protocolDist.protocols.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Protocol Distribution', 14, y);
    y += 7;

    const totalBytes = protocolDist.protocols.reduce((s, p) => s + p.bytes_sum, 0);

    autoTable(doc, {
      startY: y,
      head: [['Protocol', 'Bytes', '% of Total', 'Packets', 'Flows']],
      body: protocolDist.protocols.map((p) => [
        p.label,
        formatBytes(p.bytes_sum),
        totalBytes > 0 ? `${((p.bytes_sum / totalBytes) * 100).toFixed(1)}%` : '0%',
        formatNumber(p.packets_sum),
        formatNumber(p.flows_count),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [79, 195, 247], textColor: [13, 17, 23], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // IDS Alerts section
  if (alertsAvailable) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('IDS Alerts', 14, y);
    y += 7;

    if (!alertsSummary || alertsSummary.total === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('No alerts in the selected time range.', 14, y);
      y += 10;
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Alerts', formatNumber(alertsSummary.total)],
          ['Critical', formatNumber(alertsSummary.critical)],
          ['Medium / High', formatNumber(alertsSummary.medium)],
          ['Low', formatNumber(alertsSummary.low)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [229, 115, 115], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        margin: { left: 14, right: 14 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      const headlineRows: [string, string][] = [];

      if (latestAlert && latestAlert.timestamp) {
        const ts = format(new Date(latestAlert.timestamp), 'yyyy-MM-dd HH:mm:ss');
        const sig = latestAlert.signature ?? 'Unknown signature';
        const sev = severityLabel(latestAlert.severity);
        headlineRows.push(['Latest Attack', `[${sev}] ${ts} - ${sig}`]);
      } else {
        headlineRows.push(['Latest Attack', '-']);
      }

      if (topAttacker) {
        headlineRows.push([
          'Top Attacker IP',
          `${topAttacker.ip} (${formatNumber(topAttacker.count)} hits)`,
        ]);
      } else {
        headlineRows.push(['Top Attacker IP', '-']);
      }

      const mostCommon =
        topSignatures && topSignatures.length > 0 ? topSignatures[0] : null;
      if (mostCommon) {
        headlineRows.push([
          'Most Common Signature',
          `[${severityLabel(mostCommon.severity)}] ${mostCommon.signature} (${formatNumber(mostCommon.count)} hits)`,
        ]);
      } else {
        headlineRows.push(['Most Common Signature', '-']);
      }

      autoTable(doc, {
        startY: y,
        head: [['Highlight', 'Detail']],
        body: headlineRows,
        theme: 'grid',
        headStyles: { fillColor: [229, 115, 115], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      if (topSignatures && topSignatures.length > 0) {
        if (y > 230) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30);
        doc.text('Top Signatures', 14, y);
        y += 7;

        autoTable(doc, {
          startY: y,
          head: [['#', 'Signature', 'Severity', 'Count']],
          body: topSignatures.map((s, i) => [
            String(i + 1),
            s.signature,
            severityLabel(s.severity),
            formatNumber(s.count),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [229, 115, 115], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 10, cellPadding: 3 },
          margin: { left: 14, right: 14 },
        });

        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }
    }
  } else {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('IDS Alerts', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text('(Alerts unavailable)', 14, y);
    y += 10;
  }

  // Top sources
  if (topSources && topSources.endpoints.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Top Sources', 14, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [['#', 'IP Address', 'Bytes', 'Packets', 'Flows']],
      body: topSources.endpoints.map((ep, i) => [
        String(i + 1),
        ep.ip,
        formatBytes(ep.bytes_sum),
        formatNumber(ep.packets_sum),
        formatNumber(ep.flows_count),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [79, 195, 247], textColor: [13, 17, 23], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Top destinations
  if (topDestinations && topDestinations.endpoints.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Top Destinations', 14, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [['#', 'IP Address', 'Bytes', 'Packets', 'Flows']],
      body: topDestinations.endpoints.map((ep, i) => [
        String(i + 1),
        ep.ip,
        formatBytes(ep.bytes_sum),
        formatNumber(ep.packets_sum),
        formatNumber(ep.flows_count),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [79, 195, 247], textColor: [13, 17, 23], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `GWMON Report — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' },
    );
  }

  const filename = `gwmon-report_${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
  doc.save(filename);
}
