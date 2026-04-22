import * as vscode from 'vscode';
import type { DangerZone } from '../types';

export class DiagnosticsProvider {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('vibeaudit');
  }

  update(dangerZones: DangerZone[]): void {
    this.collection.clear();

    const byFile = new Map<string, DangerZone[]>();
    for (const zone of dangerZones) {
      const existing = byFile.get(zone.file) ?? [];
      existing.push(zone);
      byFile.set(zone.file, existing);
    }

    for (const [file, zones] of byFile.entries()) {
      const uri = vscode.Uri.file(file);
      const diagnostics: vscode.Diagnostic[] = zones.map(zone => {
        const line = Math.max(0, zone.startLine);
        const range = new vscode.Range(line, 0, Math.max(line, zone.endLine), 0);
        const diag = new vscode.Diagnostic(
          range,
          `VibeAudit: You scored ${zone.understandingScore}% on understanding this ${zone.category} code. Risk level: ${zone.riskLevel}/10.`,
          vscode.DiagnosticSeverity.Information
        );
        diag.source = 'VibeAudit';
        return diag;
      });
      this.collection.set(uri, diagnostics);
    }
  }

  dispose(): void {
    this.collection.dispose();
  }
}
