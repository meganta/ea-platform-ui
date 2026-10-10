import { attentionItems, decisionShares, enterpriseCompleteness, enterpriseMaturity, HealthDomain, levelForScore, pct, rankDomains } from '../dashboardModel';

const d = (code: string, objects: number, score: number | null, extra: Partial<HealthDomain> = {}): HealthDomain => ({
  domain: { code, name: code }, objectCount: objects, completeness: score, relationshipCompleteness: null, referenceCoverage: null,
  maturity: { score, level: score == null ? null : levelForScore(score), targetLevel: 3, gapPoints: score == null ? null : Math.max(0, 40 - score) },
  ...extra,
});

describe('dashboardModel', () => {
  it('levels follow the 20/40/60/80 thresholds', () => {
    expect([0, 19.9, 20, 40, 60, 80, 100].map(levelForScore)).toEqual([1, 1, 2, 3, 4, 5, 5]);
  });

  it('enterprise maturity is weighted by objects and leaves unmeasured domains out', () => {
    const m = enterpriseMaturity([d('A', 100, 30), d('B', 300, 70), d('C', 50, null), d('D', 0, 90)]);
    expect(m).toEqual({ score: 60, level: 4, targetLevel: 3, measured: 2, belowTarget: 1 });
    expect(enterpriseMaturity([d('C', 10, null)])).toBeNull();
  });

  it('completeness is weighted by objects', () => {
    expect(enterpriseCompleteness([d('A', 100, 50), d('B', 300, 70)])).toBe(65);
    expect(enterpriseCompleteness([])).toBeNull();
  });

  it('ranks domains by gap, unmeasured last', () => {
    expect(rankDomains([d('B', 1, 35), d('U', 1, null), d('A', 1, 10)]).map(x => x.domain.code)).toEqual(['A', 'B', 'U']);
  });

  it('attention: critical actions and findings first, positives kept apart, capped', () => {
    const insights = [
      { key: 'l', kind: 'x', severity: 'LOW', title: 'low' },
      { key: 'h', kind: 'x', severity: 'HIGH', title: 'high' },
      { key: 'p', kind: 'x', severity: 'POSITIVE', title: 'good' },
    ];
    const r = attentionItems({ insights, topActions: [{ code: 'X', priority: 'CRITICAL', problem: 'p', action: 'a' }, { code: 'Y', priority: 'HIGH', problem: 'q', action: 'b' }], gov: { summary: { criticalOpenFindings: 3 } }, max: 3 });
    expect(r.items.map(i => i.key)).toEqual(['action::X', 'gov:critical', 'h']);
    expect(r.more).toBe(1);
    expect(r.positive.map(p => p.key)).toEqual(['p']);
    expect(attentionItems({}).items).toEqual([]);
  });

  it('attention: at most three critical actions, each naming and opening its domain', () => {
    const actions = ['A', 'B', 'C', 'D'].map(c => ({ code: 'GAP', priority: 'CRITICAL', problem: 'Completeness is low', action: 'Collect', domainCode: c, domainName: `Domain ${c}` }));
    const r = attentionItems({ topActions: actions, insights: [{ key: 'm', kind: 'x', severity: 'MEDIUM', title: 'medium' }] });
    expect(r.items.map(i => i.title)).toEqual(['Domain A: Completeness is low', 'Domain B: Completeness is low', 'Domain C: Completeness is low', 'medium']);
    expect(r.items[0].link).toBe('/architecture-health?domain=A');
  });

  it('decision shares in fixed order', () => {
    const s = decisionShares({ REJECTED: 1, APPROVED: 3 });
    expect(s.total).toBe(4);
    expect(s.parts.map(p => [p.key, p.pct])).toEqual([['APPROVED', 75], ['APPROVED_WITH_CONDITIONS', 0], ['REQUIRES_CHANGES', 0], ['REJECTED', 25]]);
    expect(decisionShares().total).toBe(0);
  });

  it('pct formats missing values as a dash', () => {
    expect(pct(64.6)).toBe('65%');
    expect(pct(null)).toBe('—');
    expect(pct(NaN)).toBe('—');
  });
});
