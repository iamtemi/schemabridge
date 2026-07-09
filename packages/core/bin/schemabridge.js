#!/usr/bin/env node
import { fileURLToPath as An } from 'node:url';
import z from 'node:path';
import ve from 'node:process';
import P from 'node:path';
function ke(e, n) {
  let t = {
      typingImports: new Set(),
      pydanticImports: new Set(['BaseModel']),
      needsUUID: !1,
      needsDate: !1,
      needsDatetime: !1,
      needsTime: !1,
      needsTimedelta: !1,
      needsIPv4: !1,
      needsIPv6: !1,
      regexConstants: new Map(),
      regexOrder: [],
      warnings: n.warnings ?? [],
      renderedPaths: new Set(),
      pathNameMap: new Map(),
      nameCounts: new Map(),
      enumClasses: new Map(),
      enumClassesToRender: [],
      enumStyle: n.enumStyle ?? 'enum',
      enumBaseType: n.enumBaseType ?? 'str',
    },
    i = ie(e, n.name, t, []),
    r = Ee(t),
    o = Te(t),
    s = Ce(t);
  return [r, o, s, i].filter(Boolean).join(`

`);
}
function xe(e, n) {
  if (e.type !== 'enum')
    throw new Error('Root schema must be an enum to generate Pydantic Enum class.');
  if ((n.enumStyle ?? 'enum') === 'literal') {
    let o = e.values.map((s) => C(s));
    return ['from typing import Literal', '', `type ${F(n.name)} = Literal[${o.join(', ')}]`].join(`
`);
  }
  let i = F(n.name);
  return ['from enum import Enum', '', $e(i, e.values, n.enumBaseType ?? 'str')].join(`
`);
}
function Se(e, n) {
  let t = {
      typingImports: new Set(),
      pydanticImports: new Set(['BaseModel']),
      needsUUID: !1,
      needsDate: !1,
      needsDatetime: !1,
      needsTime: !1,
      needsTimedelta: !1,
      needsIPv4: !1,
      needsIPv6: !1,
      regexConstants: new Map(),
      regexOrder: [],
      enumClasses: new Map(),
      enumClassesToRender: [],
      warnings: n.warnings ?? [],
      renderedPaths: new Set(),
      pathNameMap: new Map(),
      nameCounts: new Map(),
      enumStyle: n.enumStyle ?? 'enum',
      enumBaseType: n.enumBaseType ?? 'str',
    },
    i = F(n.name),
    r = V(e, t, [], i),
    o = [];
  Z(e, [], (c, m) => {
    let d = m.join('.');
    if (t.renderedPaths.has(d)) return;
    t.renderedPaths.add(d);
    let f = m.at(-1) ?? i,
      h = _(d, f, t, m, i);
    o.push(ie(c, h, t, m));
  });
  let s = Ee(t),
    a = Te(t),
    u = Ce(t);
  return [s, a, u, ...o, `type ${i} = ${r.annotation}`].filter(Boolean).join(`

`);
}
function ie(e, n, t, i) {
  if (e.type !== 'object') throw new Error(`Cannot render non-object node as class "${n}"`);
  let r = _(i.join('.') || n, n, t, i),
    o = [];
  for (let [l, c] of Object.entries(e.fields))
    Z(c, [...i, l], (m, d) => {
      let f = d.join('.');
      if (t.renderedPaths.has(f)) return;
      t.renderedPaths.add(f);
      let h = _(f, d.at(-1) ?? 'Model', t, d, n);
      o.push(ie(m, h, t, d));
    });
  let s = [];
  for (let [l, c] of Object.entries(e.fields)) s.push(Ue(l, c, t, [...i, l], n));
  let a = (l) => (l.length === 0 ? '' : `    ${l}`),
    u = [];
  for (let l of [...o, ...(s.length ? s : ['pass'])])
    l.includes(`
`)
      ? u.push(
          ...l
            .split(
              `
`,
            )
            .map(a),
        )
      : u.push(a(l));
  return [`class ${r}(BaseModel):`, ...u].join(`
`);
}
function Ue(e, n, t, i, r) {
  let { annotation: o, defaultCode: s, optional: a } = V(n, t, i, r),
    { name: u, alias: l } = Je(e),
    c = s;
  return (
    l && ((c = Ye(c, l, a ?? !1)), t.pydanticImports.add('Field')),
    c !== void 0 ? `${u}: ${o} = ${c}` : `${u}: ${o}`
  );
}
function V(e, n, t, i) {
  let { inner: r, optional: o, nullable: s, defaultValue: a } = Ne(e),
    u = ze(r, n, t, i),
    l = u.annotation;
  (s && (n.typingImports.add('Optional'), (l = `Optional[${l}]`)),
    o && (n.typingImports.add('Optional'), (l = `Optional[${l}]`)));
  let c = { annotation: l };
  return a !== void 0
    ? ((c.defaultCode = We(a, n)), c)
    : o
      ? ((c.defaultCode = 'None'), c)
      : (u.defaultCode !== void 0 && (c.defaultCode = u.defaultCode), (c.optional = o), c);
}
function ze(e, n, t, i) {
  switch (e.type) {
    case 'string': {
      let r = e.constraints;
      if (r) {
        n.pydanticImports.add('constr');
        let o = [];
        if (
          (r.length !== void 0
            ? o.push(`min_length=${r.length}`, `max_length=${r.length}`)
            : (r.minLength !== void 0 && o.push(`min_length=${r.minLength}`),
              r.maxLength !== void 0 && o.push(`max_length=${r.maxLength}`)),
          r.regex !== void 0)
        ) {
          let s = Ge(r.regex, t, n);
          o.push(`pattern=${s}`);
        }
        return { annotation: `constr(${o.join(', ')})` };
      }
      return { annotation: 'str' };
    }
    case 'number': {
      let r = e.constraints;
      return r
        ? (n.pydanticImports.add('confloat'), { annotation: `confloat(${we(r).join(', ')})` })
        : { annotation: 'float' };
    }
    case 'int': {
      let r = e.constraints;
      n.pydanticImports.add('conint');
      let o = r ? we(r) : [];
      return { annotation: o.length ? `conint(${o.join(', ')})` : 'conint()' };
    }
    case 'boolean':
      return { annotation: 'bool' };
    case 'date':
      return ((n.needsDate = !0), { annotation: 'date' });
    case 'isodate':
      return ((n.needsDate = !0), { annotation: 'date' });
    case 'datetime':
      return ((n.needsDatetime = !0), { annotation: 'datetime' });
    case 'uuid':
      return ((n.needsUUID = !0), { annotation: 'UUID' });
    case 'ipv4':
      return ((n.needsIPv4 = !0), { annotation: 'IPv4Address' });
    case 'ipv6':
      return ((n.needsIPv6 = !0), { annotation: 'IPv6Address' });
    case 'time':
      return ((n.needsTime = !0), { annotation: 'time' });
    case 'duration':
      return ((n.needsTimedelta = !0), { annotation: 'timedelta' });
    case 'enum': {
      if (n.enumStyle === 'literal')
        return (
          n.typingImports.add('Literal'),
          { annotation: `Literal[${e.values.map((m) => C(m)).join(', ')}]` }
        );
      let r = e.values.slice().sort(re).join('|'),
        o = n.enumClasses.get(r);
      if (o) return { annotation: o.name };
      let s = t.length > 0 ? `${t.join('.')}.Enum` : 'Enum',
        a = t.at(-1),
        u = _(s, a ? `${F(a)}Enum` : 'Enum', n, [...t, 'Enum'], i),
        l = { name: u, values: e.values, baseType: n.enumBaseType };
      return (n.enumClasses.set(r, l), n.enumClassesToRender.push(l), { annotation: u });
    }
    case 'literal':
      return (n.typingImports.add('Literal'), { annotation: `Literal[${C(e.value)}]` });
    case 'array': {
      n.typingImports.add('List');
      let r = V(e.element, n, [...t, '[item]'], i),
        o = { annotation: `List[${r.annotation}]` };
      return (r.defaultCode !== void 0 && (o.defaultCode = r.defaultCode), o);
    }
    case 'union':
      return (
        n.typingImports.add('Union'),
        {
          annotation: `Union[${e.options.map((o, s) => V(o, n, [...t, `option${s}`], i).annotation).join(', ')}]`,
        }
      );
    case 'object':
      return { annotation: _(t.join('.'), t.at(-1) ?? i, n, t, i) };
    case 'any':
    case 'unknown':
      return (n.typingImports.add('Any'), { annotation: 'Any' });
    case 'reference':
      return { annotation: e.name };
    default:
      return (n.typingImports.add('Any'), { annotation: 'Any' });
  }
}
function we(e) {
  let n = [];
  return (
    e.min && n.push(`${e.min.inclusive ? 'ge' : 'gt'}=${e.min.value}`),
    e.max && n.push(`${e.max.inclusive ? 'le' : 'lt'}=${e.max.value}`),
    e.positive && !e.min && n.push('gt=0'),
    e.nonnegative && !e.min && n.push('ge=0'),
    n
  );
}
function Ne(e) {
  let n = e,
    t = !1,
    i = !1,
    r;
  for (;;) {
    if (n.type === 'optional') {
      ((t = !0), (n = n.inner));
      continue;
    }
    if (n.type === 'nullish') {
      ((t = !0), (i = !0), (n = n.inner));
      continue;
    }
    if (n.type === 'nullable') {
      ((i = !0), (n = n.inner));
      continue;
    }
    if (n.type === 'default') {
      ((r = n.defaultValue), (n = n.inner));
      continue;
    }
    break;
  }
  return { inner: n, optional: t, nullable: i, defaultValue: r };
}
function We(e, n) {
  return (
    n.pydanticImports.add('Field'),
    Array.isArray(e)
      ? 'Field(default_factory=list)'
      : e && typeof e == 'object'
        ? 'Field(default_factory=dict)'
        : `Field(default=${C(e)})`
  );
}
function Ge(e, n, t) {
  let i = Ve(e),
    r = t.regexConstants.get(i);
  if (r) return r;
  if (typeof e == 'object' && e instanceof RegExp) {
    let a = new Set(['i', 'm', 's']),
      u = e.flags.split('').filter((l) => !a.has(l) && l !== 'u' && l !== 'g');
    u.length > 0 &&
      t.warnings.push({
        code: 'unsupported_effect',
        path: n,
        message: `Regex flags "${u.join('')}" are not mapped to Python. Only i/m/s are embedded inline; u is default in Python, g is irrelevant.`,
      });
  }
  let s = `${Xe([...n].pop() ?? 'pattern')}_REGEX`;
  return (t.regexConstants.set(i, s), t.regexOrder.push(i), s);
}
function Ve(e) {
  return typeof e == 'string' ? e : `/${e.source}/${e.flags}`;
}
function qe(e) {
  if (typeof e == 'string') return be(e);
  let n = e.flags
      .split('')
      .map((i) => {
        switch (i) {
          case 'i':
            return 'i';
          case 'm':
            return 'm';
          case 's':
            return 's';
          default:
            return '';
        }
      })
      .join(''),
    t = n ? `(?${n})` : '';
  return be(t + e.source);
}
function Te(e) {
  return e.regexOrder.length
    ? e.regexOrder.map((t) => {
        let i = e.regexConstants.get(t);
        if (!i) throw new Error(`Missing regex constant for key: ${t}`);
        return `${i} = ${qe(t.startsWith('/') ? new RegExp(t.slice(1, t.lastIndexOf('/')), t.slice(t.lastIndexOf('/') + 1)) : t)}`;
      }).join(`
`)
    : '';
}
function Ee(e) {
  let n = [],
    t = Array.from(e.pydanticImports).sort(re);
  t.length && n.push(`from pydantic import ${t.join(', ')}`);
  let i = Array.from(e.typingImports).sort(re);
  (i.length && n.push(`from typing import ${i.join(', ')}`),
    e.enumClassesToRender.length > 0 && n.push('from enum import Enum'));
  let r = [];
  (e.needsDate && r.push('date'),
    e.needsDatetime && r.push('datetime'),
    e.needsTime && r.push('time'),
    e.needsTimedelta && r.push('timedelta'),
    r.length && n.push(`from datetime import ${r.join(', ')}`),
    e.needsUUID && n.push('from uuid import UUID'));
  let o = [];
  return (
    e.needsIPv4 && o.push('IPv4Address'),
    e.needsIPv6 && o.push('IPv6Address'),
    o.length && n.push(`from ipaddress import ${o.join(', ')}`),
    n.join(`
`)
  );
}
function $e(e, n, t) {
  let i = n.map((r) => {
    let o = Ke(r),
      s = R(r);
    return `    ${o} = ${s}`;
  });
  return [`class ${e}(${t}, Enum):`, ...i].join(`
`);
}
function Ce(e) {
  return e.enumClassesToRender.length === 0
    ? ''
    : e.enumClassesToRender.map((n) => $e(n.name, n.values, n.baseType)).join(`

`);
}
function Ke(e) {
  return (
    e
      .toUpperCase()
      .replaceAll(/[^A-Z0-9_]/g, '_')
      .replaceAll(/_+/g, '_')
      .replaceAll(/^_+|_+$/g, '') || 'VALUE'
  );
}
function C(e) {
  switch (typeof e) {
    case 'string':
      return R(e);
    case 'number':
      return Number.isFinite(e) ? e.toString() : 'None';
    case 'boolean':
      return e ? 'True' : 'False';
    case 'undefined':
      return 'None';
    case 'object':
      return e === null
        ? 'None'
        : Array.isArray(e)
          ? `[${e.map((n) => C(n)).join(', ')}]`
          : '{' +
            Object.entries(e)
              .map(([n, t]) => `${R(n)}: ${C(t)}`)
              .join(', ') +
            '}';
    default:
      return 'None';
  }
}
function R(e) {
  return `"${e
    .replaceAll('\\', '\\\\')
    .replaceAll('\r', String.raw`\r`)
    .replaceAll(
      `
`,
      String.raw`\n`,
    )
    .replaceAll('	', String.raw`\t`)
    .replaceAll('\b', String.raw`\b`)
    .replaceAll('\f', String.raw`\f`)
    .replaceAll('"', String.raw`\"`)}"`;
}
function be(e) {
  return e.endsWith('\\') || /[\r\n]/.test(e) ? R(e) : `r"${e.replaceAll('"', String.raw`\"`)}"`;
}
function Je(e) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(e)
    ? { name: e }
    : {
        name:
          e
            .replaceAll(/[^A-Za-z0-9_]/g, '_')
            .replaceAll(/^[^A-Za-z_]+/g, (i) => `_${i}`)
            .replaceAll(/_+/g, '_') || '_field',
        alias: e,
      };
}
function Ye(e, n, t) {
  let i = `alias=${R(n)}`;
  if (e?.startsWith('Field(')) {
    let r = e.slice(6, -1).trim();
    return `Field(${(r ? [i, r] : [i]).join(', ')})`;
  }
  return e !== void 0
    ? `Field(${i}, default=${e})`
    : t
      ? `Field(${i}, default=None)`
      : `Field(${i}, default=...)`;
}
function _(e, n, t, i, r) {
  let o = t.pathNameMap.get(e);
  if (o) return o;
  let s = He(i, n, r),
    a = t.nameCounts.get(s) ?? 0,
    u = a === 0 ? s : `${s}${a + 1}`;
  return (t.nameCounts.set(s, a + 1), t.pathNameMap.set(e, u), u);
}
function He(e, n, t) {
  let i = e
    .filter(Boolean)
    .map((r) => (r === '[item]' ? 'Item' : (/^option\d+$/i.test(r), r)))
    .filter((r) => r !== '');
  return i.length === 0 ? F(n || t || 'Model') : F(i.join(' '));
}
function F(e) {
  return (
    e
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
      .join('') || 'Model'
  );
}
function Xe(e) {
  return e
    .replaceAll(/[^a-zA-Z0-9]+/g, '_')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();
}
function re(e, n) {
  return e < n ? -1 : e > n ? 1 : 0;
}
function Z(e, n, t) {
  let { inner: i } = Ne(e);
  if (i.type === 'object') {
    t(i, n);
    for (let [r, o] of Object.entries(i.fields)) Z(o, [...n, r], t);
    return;
  }
  if (i.type === 'array') {
    Z(i.element, [...n, '[item]'], t);
    return;
  }
  i.type === 'union' && i.options.forEach((r, o) => Z(r, [...n, `option${o}`], t));
}
function Fe(e, n) {
  let t = {
    renderedPaths: new Set(),
    warnings: n.warnings ?? [],
    exportNameOverrides: new Map(Object.entries(n.exportNameOverrides ?? {})),
    pathNameMap: new Map(),
    nameCounts: new Map(),
  };
  if (e.type === 'enum') return oe(e, n);
  if (e.type !== 'object')
    throw new Error('Root schema must be a Zod object or enum to generate TypeScript definitions.');
  return se(e, n.name, t, []);
}
function oe(e, n) {
  if (e.type !== 'enum')
    throw new Error('Root schema must be an enum to generate TypeScript enum type.');
  let t = Y(n.name),
    r = e.values.map((o) => L(o)).join(' | ');
  return `export type ${t} = ${r};`;
}
function Pe(e, n) {
  let t = {
      renderedPaths: new Set(),
      warnings: n.warnings ?? [],
      exportNameOverrides: new Map(Object.entries(n.exportNameOverrides ?? {})),
      pathNameMap: new Map(),
      nameCounts: new Map(),
    },
    i = Y(n.name),
    r = J(e, t, [], i, !1);
  return `export type ${i} = ${r.typeAnnotation};`;
}
function se(e, n, t, i) {
  if (e.type !== 'object') throw new Error(`Cannot render non-object node as interface "${n}"`);
  let r = q(i.join('.') || n, n, t, i),
    o = [];
  for (let [d, f] of Object.entries(e.fields)) {
    let { inner: h } = ae(f);
    if (h.type === 'object') {
      let p = [...i, d],
        g = p.join('.');
      if (!t.renderedPaths.has(g)) {
        t.renderedPaths.add(g);
        let v = q(p.join('.'), d, t, p, r);
        o.push(se(h, v, t, p));
      }
    } else
      K(f, [...i, d], (p, g) => {
        let v = g.join('.');
        if (t.renderedPaths.has(v)) return;
        t.renderedPaths.add(v);
        let k = q(v, g.at(-1) ?? 'Model', t, g, r);
        o.push(se(p, k, t, g));
      });
  }
  let s = [];
  for (let [d, f] of Object.entries(e.fields)) s.push(Qe(d, f, t, [...i, d], r));
  let a = (d) => (d.length === 0 ? '' : `  ${d}`),
    u = [];
  for (let d of s.length ? s : []) u.push(a(d));
  let l =
      u.length > 0
        ? ` {
${u.join(`
`)}
}`
        : ' {}',
    c = `export interface ${r}${l}`;
  return [...o, c].join(`

`);
}
function Qe(e, n, t, i, r) {
  let { typeAnnotation: o, isOptional: s } = J(n, t, i, r, !0),
    a = s ? '?' : '';
  return `${nn(e)}${a}: ${o};`;
}
function J(e, n, t, i, r) {
  let { inner: o, optional: s, nullable: a, nullish: u } = ae(e),
    l = en(o, n, t, i),
    c = l,
    m = !1;
  return (
    r
      ? u
        ? ((m = !0), (c = `${l} | null`))
        : s && a
          ? ((m = !0), (c = `${l} | null`))
          : s
            ? ((m = !0), (c = l))
            : a && (c = `${l} | null`)
      : u
        ? (c = `${l} | null | undefined`)
        : s && a
          ? (c = `${l} | null | undefined`)
          : s
            ? (c = `${l} | undefined`)
            : a && (c = `${l} | null`),
    { typeAnnotation: c, isOptional: m }
  );
}
function en(e, n, t, i) {
  switch (e.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'int':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'Date';
    case 'isodate':
      return 'string';
    case 'datetime':
      return 'string';
    case 'uuid':
      return 'string';
    case 'ipv4':
      return 'string';
    case 'ipv6':
      return 'string';
    case 'time':
      return 'string';
    case 'duration':
      return 'string';
    case 'enum':
      return e.values.map((o) => L(o)).join(' | ');
    case 'literal':
      return L(e.value);
    case 'array': {
      let r = J(e.element, n, [...t, '[item]'], i, !1);
      return `${r.typeAnnotation.includes(' | ') ? `(${r.typeAnnotation})` : r.typeAnnotation}[]`;
    }
    case 'union':
      return e.options
        .map((o, s) => J(o, n, [...t, `option${s}`], i, !1))
        .map((o) => o.typeAnnotation)
        .join(' | ');
    case 'object': {
      let r = t.join('.');
      return n.exportNameOverrides.get(r) ?? q(t.join('.'), t.at(-1) ?? i, n, t, i);
    }
    case 'any':
      return 'any';
    case 'unknown':
      return 'unknown';
    case 'reference':
      return e.name;
    default:
      return 'any';
  }
}
function ae(e) {
  let n = e,
    t = !1,
    i = !1,
    r = !1;
  for (;;) {
    if (n.type === 'optional') {
      ((t = !0), (n = n.inner));
      continue;
    }
    if (n.type === 'nullish') {
      ((r = !0), (t = !0), (i = !0), (n = n.inner));
      continue;
    }
    if (n.type === 'nullable') {
      ((i = !0), (n = n.inner));
      continue;
    }
    if (n.type === 'default') {
      n = n.inner;
      continue;
    }
    break;
  }
  return { inner: n, optional: t, nullable: i, nullish: r };
}
function L(e) {
  switch (typeof e) {
    case 'string':
      return JSON.stringify(e);
    case 'number':
      return Number.isFinite(e) ? e.toString() : 'null';
    case 'boolean':
      return e ? 'true' : 'false';
    case 'undefined':
      return 'undefined';
    case 'object':
      return e === null
        ? 'null'
        : Array.isArray(e)
          ? `[${e.map((n) => L(n)).join(', ')}]`
          : '{ ' +
            Object.entries(e)
              .map(([n, t]) => `${JSON.stringify(n)}: ${L(t)}`)
              .join(', ') +
            ' }';
    default:
      return 'any';
  }
}
function Y(e) {
  return (
    e
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
      .join('') || 'Model'
  );
}
function nn(e) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(e) ? e : JSON.stringify(e);
}
function q(e, n, t, i, r) {
  let o = t.exportNameOverrides.get(e);
  if (o) return (t.pathNameMap.set(e, o), o);
  let s = t.pathNameMap.get(e);
  if (s) return s;
  let a = tn(i, n, r),
    u = t.nameCounts.get(a) ?? 0,
    l = u === 0 ? a : `${a}${u + 1}`;
  return (t.nameCounts.set(a, u + 1), t.pathNameMap.set(e, l), l);
}
function tn(e, n, t) {
  let i = e
    .filter(Boolean)
    .map((r) => (r === '[item]' ? 'Item' : (/^option\d+$/i.test(r), r)))
    .filter((r) => r !== '');
  return i.length === 0 ? Y(n || t || 'Model') : Y(i.join(' '));
}
function K(e, n, t) {
  let { inner: i } = ae(e);
  if (i.type === 'object') {
    t(i, n);
    for (let [r, o] of Object.entries(i.fields)) K(o, [...n, r], t);
    return;
  }
  if (i.type === 'array') {
    K(i.element, [...n, '[item]'], t);
    return;
  }
  i.type === 'union' && i.options.forEach((r, o) => K(r, [...n, `option${o}`], t));
}
function ue(e, n = []) {
  let t = [];
  return { node: S(e, n, t), warnings: t };
}
function S(e, n, t) {
  if (rn(e)) return { type: 'literal', value: e };
  let i = on(e);
  if (!i || typeof i != 'object') throw new Error('Invalid Zod schema definition');
  let r = i,
    o = an(r);
  switch (o) {
    case 'optional':
    case 'ZodOptional': {
      let s = r.innerType;
      return { type: 'optional', inner: S(s, n, t) };
    }
    case 'nullable':
    case 'ZodNullable': {
      let s = r.innerType;
      return { type: 'nullable', inner: S(s, n, t) };
    }
    case 'nullish':
    case 'ZodNullish': {
      let s = r.innerType;
      return { type: 'nullish', inner: S(s, n, t) };
    }
    case 'default':
    case 'ZodDefault': {
      let s = r.innerType,
        a = r.defaultValue,
        u = typeof a == 'function' ? void 0 : a;
      return (
        typeof a == 'function' &&
          t.push({
            code: 'unsupported_effect',
            path: n,
            message:
              'Encountered function default factory; skipping execution and default value extraction.',
          }),
        { type: 'default', defaultValue: u, inner: S(s, n, t) }
      );
    }
    case 'effects':
    case 'ZodEffects': {
      let s = r.effect?.type ?? r.effects?.[0]?.type;
      t.push({
        code: 'unsupported_effect',
        path: n,
        message: `Encountered Zod effect${s ? ` "${s}"` : ''}; using base schema shape.`,
      });
      let a = r.schema ?? r.innerType;
      return S(a, n, t);
    }
    case 'pipe': {
      t.push({
        code: 'unsupported_effect',
        path: n,
        message: 'Encountered Zod pipeline; using input schema shape.',
      });
      let s = r.in ?? r.schema;
      return S(s, n, t);
    }
  }
  switch (o) {
    case 'string':
    case 'ZodString': {
      let { constraints: s, inferredType: a } = un(r);
      return a === 'uuid'
        ? { type: 'uuid' }
        : a === 'isodate'
          ? { type: 'isodate' }
          : a === 'datetime'
            ? { type: 'datetime' }
            : a === 'ipv4'
              ? { type: 'ipv4' }
              : a === 'ipv6'
                ? { type: 'ipv6' }
                : a === 'time'
                  ? { type: 'time' }
                  : a === 'duration'
                    ? { type: 'duration' }
                    : s
                      ? { type: 'string', constraints: s }
                      : { type: 'string' };
    }
    case 'number':
    case 'ZodNumber': {
      let { constraints: s, isInt: a } = ln(r);
      return a
        ? s
          ? { type: 'int', constraints: s }
          : { type: 'int' }
        : s
          ? { type: 'number', constraints: s }
          : { type: 'number' };
    }
    case 'boolean':
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'date':
    case 'ZodDate':
      return { type: 'date' };
    case 'uuid':
      return { type: 'uuid' };
    case 'enum':
    case 'ZodEnum':
      return {
        type: 'enum',
        values: r.values ?? (r.entries ? Object.values(r.entries) : void 0) ?? [],
      };
    case 'literal':
    case 'ZodLiteral': {
      let s = 'value' in r ? r.value : void 0,
        a = 'values' in r && Array.isArray(r.values) ? r.values[0] : void 0,
        u = 'values' in r && r.values instanceof Set ? r.values.values().next().value : void 0;
      return { type: 'literal', value: s ?? a ?? u };
    }
    case 'null':
    case 'ZodNull':
      return { type: 'literal', value: null };
    case 'object':
    case 'ZodObject': {
      let s = r.shape,
        a = typeof s == 'function' ? s() : s,
        u = {};
      for (let [l, c] of Object.entries(a)) u[l] = S(c, [...n, l], t);
      return { type: 'object', fields: u };
    }
    case 'array':
    case 'ZodArray': {
      let s = r.element ?? (r.type !== 'array' ? r.type : void 0) ?? r.elementType ?? r.items;
      if (!s) throw new Error('Array schema missing element type');
      return { type: 'array', element: S(s, [...n, '[element]'], t) };
    }
    case 'union':
    case 'ZodUnion':
      return {
        type: 'union',
        options: (r.options || []).map((a, u) => S(a, [...n, `option${u}`], t)),
      };
    case 'ZodDiscriminatedUnion': {
      let s = r.options ?? r.optionsMap;
      return {
        type: 'union',
        options: (s ? Array.from(s.values()) : []).map((u, l) => S(u, [...n, `option${l}`], t)),
      };
    }
    case 'any':
    case 'ZodAny':
      return { type: 'any' };
    case 'unknown':
    case 'ZodUnknown':
      return { type: 'unknown' };
    default:
      return (
        t.push({
          code: 'unknown_type',
          path: n,
          message: `Unknown or unsupported Zod schema type "${String(o)}"; defaulting to 'any'.`,
        }),
        { type: 'any' }
      );
  }
}
function rn(e) {
  return e === null || typeof e == 'string' || typeof e == 'number' || typeof e == 'boolean';
}
function sn(e) {
  return typeof e == 'object' && e !== null && '_zod' in e;
}
function on(e) {
  return sn(e) ? e._zod.def : e._def;
}
function an(e) {
  let n = typeof e.type == 'string' ? e.type : void 0;
  if (n) return n;
  let t =
    typeof e.typeName == 'string'
      ? e.typeName
      : typeof e.typeName == 'symbol'
        ? e.typeName.description
        : void 0;
  if (t) return t.startsWith('Symbol(') && t.endsWith(')') ? t.slice(7, -1) : t;
}
function un(e) {
  let n = e.checks || [],
    t = {},
    i;
  for (let o of n) {
    let s = je(o);
    if (s)
      switch (s.kind) {
        case 'min':
          t.minLength = s.value;
          break;
        case 'max':
          t.maxLength = s.value;
          break;
        case 'length':
          t.length = s.value;
          break;
        case 'regex':
          t.regex = s.regex;
          break;
        case 'uuid':
          i = 'uuid';
          break;
        case 'datetime':
          i = 'datetime';
          break;
        case 'isodate':
          i = 'isodate';
          break;
        case 'ipv4':
          i = 'ipv4';
          break;
        case 'ipv6':
          i = 'ipv6';
          break;
        case 'time':
          i = 'time';
          break;
        case 'duration':
          i = 'duration';
          break;
      }
  }
  if (n.length === 0 && e.check) {
    let o = je(e);
    if (o)
      switch (o.kind) {
        case 'uuid':
          i = 'uuid';
          break;
        case 'datetime':
          i = 'datetime';
          break;
        case 'isodate':
          i = 'isodate';
          break;
        case 'ipv4':
          i = 'ipv4';
          break;
        case 'ipv6':
          i = 'ipv6';
          break;
        case 'time':
          i = 'time';
          break;
        case 'duration':
          i = 'duration';
          break;
        case 'regex':
          t.regex = o.regex;
          break;
        case 'min':
          t.minLength = o.value;
          break;
        case 'max':
          t.maxLength = o.value;
          break;
        case 'length':
          t.length = o.value;
          break;
      }
  }
  let r = {};
  return (
    Object.keys(t).length > 0 && (r.constraints = t),
    i !== void 0 && (r.inferredType = i),
    r
  );
}
function ln(e) {
  let n = e.checks || [],
    t = {},
    i = !1;
  for (let o of n) {
    let s = Me(o);
    if (s)
      switch (s.kind) {
        case 'min':
          ((t.min = { value: s.value, inclusive: s.inclusive ?? !0 }),
            t.min.value === 0 && t.min.inclusive === !1 && (t.positive = !0),
            t.min.value === 0 && t.min.inclusive === !0 && (t.nonnegative = !0));
          break;
        case 'max':
          t.max = { value: s.value, inclusive: s.inclusive ?? !0 };
          break;
        case 'int':
          i = !0;
          break;
      }
  }
  if (n.length === 0 && e.check) {
    let o = Me(e);
    if (o)
      switch (o.kind) {
        case 'int':
          i = !0;
          break;
        case 'min':
          ((t.min = { value: o.value, inclusive: o.inclusive ?? !0 }),
            t.min.value === 0 && t.min.inclusive === !1 && (t.positive = !0),
            t.min.value === 0 && t.min.inclusive === !0 && (t.nonnegative = !0));
          break;
        case 'max':
          t.max = { value: o.value, inclusive: o.inclusive ?? !0 };
          break;
      }
  }
  let r = { isInt: i };
  return (Object.keys(t).length > 0 && (r.constraints = t), r);
}
function je(e) {
  if (!e || typeof e != 'object') return null;
  if ('kind' in e) {
    let r = e;
    switch (r.kind) {
      case 'min':
        return { kind: 'min', value: r.value };
      case 'max':
        return { kind: 'max', value: r.value };
      case 'length':
        return { kind: 'length', value: r.value };
      case 'regex':
        return { kind: 'regex', regex: r.regex };
      case 'uuid':
        return { kind: 'uuid' };
      case 'datetime':
        return { kind: 'datetime' };
      case 'date':
        return { kind: 'isodate' };
      case 'ipv4':
        return { kind: 'ipv4' };
      case 'ipv6':
        return { kind: 'ipv6' };
      case 'time':
        return { kind: 'time' };
      case 'duration':
        return { kind: 'duration' };
    }
  }
  if (e.check === 'string_format') {
    let r = e.format;
    if (r === 'regex' && e.pattern) return { kind: 'regex', regex: e.pattern };
    if (r === 'uuid') return { kind: 'uuid' };
    if (r === 'datetime') return { kind: 'datetime' };
    if (r === 'date') return { kind: 'isodate' };
    if (r === 'ipv4') return { kind: 'ipv4' };
    if (r === 'ipv6') return { kind: 'ipv6' };
    if (r === 'time') return { kind: 'time' };
    if (r === 'duration') return { kind: 'duration' };
  }
  let t = e._zod?.def ?? e.def;
  if (!t) return null;
  switch (t.check) {
    case 'min_length':
      return { kind: 'min', value: t.minimum };
    case 'max_length':
      return { kind: 'max', value: t.maximum };
    case 'length_equals':
      return { kind: 'length', value: t.length };
    case 'string_format': {
      let r = t.format;
      return r === 'regex' && t.pattern
        ? { kind: 'regex', regex: t.pattern }
        : r === 'uuid'
          ? { kind: 'uuid' }
          : r === 'datetime'
            ? { kind: 'datetime' }
            : r === 'date'
              ? { kind: 'isodate' }
              : r === 'ipv4'
                ? { kind: 'ipv4' }
                : r === 'ipv6'
                  ? { kind: 'ipv6' }
                  : r === 'time'
                    ? { kind: 'time' }
                    : r === 'duration'
                      ? { kind: 'duration' }
                      : null;
    }
    default:
      return null;
  }
}
function Me(e) {
  if (!e || typeof e != 'object') return null;
  if ('kind' in e) {
    let o = e;
    switch (o.kind) {
      case 'min': {
        let s = { kind: 'min', value: o.value };
        return (o.inclusive !== void 0 && (s.inclusive = o.inclusive), s);
      }
      case 'max': {
        let s = { kind: 'max', value: o.value };
        return (o.inclusive !== void 0 && (s.inclusive = o.inclusive), s);
      }
      case 'int':
        return { kind: 'int' };
      case 'positive':
        return { kind: 'min', value: 0, inclusive: !1 };
      case 'nonnegative':
        return { kind: 'min', value: 0, inclusive: !0 };
    }
  }
  let n = e.check;
  if (n === 'number_format') {
    let o = e.format;
    if (o === 'int' || o === 'safeint') return { kind: 'int' };
  }
  if (n === 'greater_than') {
    let o = e.value,
      s = e.inclusive;
    if (o !== void 0) return { kind: 'min', value: o, inclusive: s ?? !1 };
  }
  if (n === 'less_than') {
    let o = e.value,
      s = e.inclusive;
    if (o !== void 0) return { kind: 'max', value: o, inclusive: s ?? !1 };
  }
  let t = e._zod?.def,
    i = e.def,
    r = t ?? i ?? void 0;
  if (r)
    switch (r.check) {
      case 'greater_than':
        return { kind: 'min', value: r.value, inclusive: r.inclusive };
      case 'less_than':
        return { kind: 'max', value: r.value, inclusive: r.inclusive };
      case 'number_format': {
        let s = r.format;
        if (s === 'int' || s === 'safeint') return { kind: 'int' };
        break;
      }
    }
  return e.isInt === !0 ? { kind: 'int' } : null;
}
import le from 'node:fs/promises';
import cn from 'node:path';
var Oe = '# Generated by SchemaBridge. Do not edit.',
  Ae = '// Generated by SchemaBridge. Do not edit.';
async function Ie(e, n, t) {
  let i = ce(n, t),
    r = await H(e);
  return r !== void 0 && B(r) === i
    ? 'unchanged'
    : (await le.mkdir(cn.dirname(e), { recursive: !0 }),
      await le.writeFile(e, i, 'utf8'),
      'written');
}
function ce(e, n) {
  return dn(e, n);
}
async function H(e) {
  try {
    return await le.readFile(e, 'utf8');
  } catch (n) {
    if (pn(n) && n.code === 'ENOENT') return;
    throw n;
  }
}
function Ze(e, n) {
  let t = B(n).split(`
`)[0];
  return e.endsWith('.py') ? t === Oe : e.endsWith('.d.ts') ? t === Ae : !1;
}
function dn(e, n) {
  let t = n === 'pydantic' ? Oe : Ae,
    i = B(e);
  return i.startsWith(`${t}
`)
    ? i
    : i.trim().length === 0
      ? `${t}
`
      : `${t}

${i}`;
}
function B(e) {
  return `${e
    .replace(
      /\r\n/g,
      `
`,
    )
    .replace(
      /\r/g,
      `
`,
    )
    .replace(/\n*$/g, '')}
`;
}
function pn(e) {
  return e instanceof Error && 'code' in e;
}
import { pathToFileURL as mn } from 'node:url';
import T from 'node:path';
import de from 'node:fs/promises';
import $ from 'typescript';
function X(e) {
  return !e || typeof e != 'object' ? !1 : '_def' in e || '_zod' in e;
}
var D = null;
async function Q() {
  if (D) {
    await D;
    return;
  }
  ((D = import('tsx/esm').catch((e) => {
    D = null;
    let n = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to register TypeScript loader (tsx). Install "tsx" as a dependency or precompile schemas. ${n}`,
    );
  })),
    await D);
}
var N = class extends Error {
  constructor(n) {
    (super(n), (this.name = 'SchemaLoadError'));
  }
};
async function pe(e) {
  if (!e.trustedInput)
    throw new N(
      'Refusing to dynamically import untrusted schema modules. Set trustedInput: true only for trusted local files.',
    );
  let n = T.resolve(e.file);
  e.registerTsLoader && (await Q());
  let { warnings: t, dependencies: i } = await fn(n, {
      ...(e.tsconfigPath !== void 0 && { tsconfigPath: e.tsconfigPath }),
      ...(e.allowUnresolved !== void 0 && { allowUnresolved: e.allowUnresolved }),
    }),
    r;
  try {
    r = await import(mn(n).href);
  } catch (s) {
    let a = s instanceof Error ? s.message : String(s);
    throw new N(`Failed to import schema module "${n}": ${a}`);
  }
  if (!(e.exportName in r)) {
    let s = Object.keys(r).filter((a) => a !== 'default');
    throw new N(
      `Export "${e.exportName}" not found in "${n}". Available exports: ${s.join(', ') || '(none)'}`,
    );
  }
  let o = r[e.exportName];
  if (!X(o)) throw new N(`Export "${e.exportName}" in "${n}" is not a Zod schema.`);
  return { schema: o, warnings: t, dependencies: i };
}
async function fn(e, n) {
  let t = new Set(),
    i = [],
    r = [T.resolve(e)],
    o = n.tsconfigPath ? await gn(n.tsconfigPath) : void 0;
  for (; r.length; ) {
    let s = r.pop();
    if (!s || t.has(s)) continue;
    t.add(s);
    let a;
    try {
      a = await de.readFile(s, 'utf8');
    } catch {
      continue;
    }
    let u = T.dirname(s),
      c = $.createSourceFile(s, a, $.ScriptTarget.Latest, !0).statements.filter(
        $.isImportDeclaration,
      );
    for (let m of c) {
      if (!m.moduleSpecifier || !$.isStringLiteral(m.moduleSpecifier)) continue;
      let d = m.moduleSpecifier.text,
        f = await yn(d, u, o);
      if (f !== null) {
        if (!f) {
          if (n.allowUnresolved) {
            i.push(`Unresolved import "${d}" from ${s}`);
            continue;
          }
          throw new N(`Failed to resolve import "${d}" from ${s}`);
        }
        r.push(f);
      }
    }
  }
  return { warnings: i, dependencies: Array.from(t) };
}
async function gn(e) {
  try {
    let n = await de.readFile(e, 'utf8'),
      t = $.parseConfigFileTextToJson(e, n);
    return t.error ? void 0 : $.parseJsonConfigFileContent(t.config, $.sys, T.dirname(e));
  } catch {
    return;
  }
}
async function yn(e, n, t) {
  if (e.startsWith('.') || e.startsWith('/')) return await Re(T.resolve(n, e));
  if (t?.options.paths && t.options.baseUrl) {
    let i = hn(e, t.options.baseUrl, t.options.paths);
    if (i) {
      let r = await Re(i);
      if (r) return r;
    }
  }
  return null;
}
function hn(e, n, t) {
  for (let [i, r] of Object.entries(t)) {
    let o = i.indexOf('*');
    if (o === -1) {
      if (i === e && r.length > 0) {
        let u = r[0];
        if (u) return T.resolve(n, u);
      }
      continue;
    }
    let s = i.slice(0, o),
      a = i.slice(o + 1);
    if (e.startsWith(s) && e.endsWith(a) && r.length > 0) {
      let u = r[0];
      if (u) {
        let l = e.slice(s.length, e.length - a.length),
          c = u.replace('*', l);
        return T.resolve(n, c);
      }
    }
  }
  return null;
}
async function Re(e) {
  let n = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'],
    t = new Set();
  for (let r of n) t.add(e.endsWith(r) ? e : e + r);
  let i = T.parse(e);
  if (['.js', '.mjs', '.cjs'].includes(i.ext)) {
    let r = T.join(i.dir, i.name);
    for (let o of n) t.add(r + o);
  }
  for (let r of t)
    try {
      if ((await de.stat(r)).isFile()) return r;
    } catch {
      continue;
    }
  return null;
}
import vn from 'node:fs/promises';
import ee from 'node:path';
import { pathToFileURL as wn } from 'node:url';
async function me(e) {
  let {
    sourceDir: n,
    extensions: t = ['.ts', '.tsx', '.js', '.mjs'],
    ignore: i = ['node_modules', '.git', 'dist', 'build', 'coverage'],
    registerTsLoader: r = !0,
    tsconfigPath: o,
    allowUnresolved: s = !1,
    trustedInput: a = !1,
    exportNamePattern: u,
  } = e;
  if (!a)
    throw new Error(
      'Refusing to dynamically import untrusted schema files. Set trustedInput: true only for trusted local files.',
    );
  let l = ee.resolve(n),
    c = [],
    m = [],
    d = [];
  r && (await Q());
  let f = u !== void 0 ? xn(u) : void 0,
    h = await bn(l, t, i),
    p = new Set();
  for (let g of h)
    if (!p.has(g)) {
      p.add(g);
      try {
        let v = { registerTsLoader: !1, allowUnresolved: s };
        o !== void 0 && (v.tsconfigPath = o);
        let k = await kn(g, v),
          x = f !== void 0 ? k.filter((j) => f.test(j.exportName)) : k;
        if (x.length === 0) {
          d.push(g);
          continue;
        }
        c.push(...x);
      } catch (v) {
        let k = v instanceof Error ? v.message : String(v);
        if (s) {
          (m.push(`Failed to process ${g}: ${k}`), d.push(g));
          continue;
        }
        throw v instanceof Error ? v : new Error(k);
      }
    }
  return { schemas: c, warnings: m, skippedFiles: d };
}
async function bn(e, n, t) {
  let i = [],
    r = new Set(n);
  async function o(s) {
    let a = (await vn.readdir(s, { withFileTypes: !0 })).sort((u, l) => _e(u.name, l.name));
    for (let u of a) {
      let l = ee.join(s, u.name);
      if (!t.some((c) => u.name.includes(c))) {
        if (u.isDirectory()) await o(l);
        else if (u.isFile()) {
          let c = ee.extname(u.name);
          r.has(c) && i.push(l);
        }
      }
    }
  }
  return (await o(e), i);
}
async function kn(e, n) {
  let t = ee.resolve(e),
    i = await import(wn(t).href),
    r = [],
    o = Object.entries(i).sort(([s], [a]) => _e(s, a));
  for (let [s, a] of o) s !== 'default' && X(a) && r.push({ file: t, exportName: s, schema: a });
  return r;
}
function xn(e) {
  let n = e.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${n}$`);
}
function _e(e, n) {
  return e < n ? -1 : e > n ? 1 : 0;
}
import U from 'node:fs/promises';
import y from 'node:path';
async function ge(e) {
  let {
      outDir: n,
      target: t,
      clean: i = !1,
      verify: r = !1,
      preserveStructure: o = !0,
      skipEmptyFiles: s = !0,
      generateInitFiles: a = !1,
      ...u
    } = e,
    l = y.resolve(n);
  r || (await U.mkdir(l, { recursive: !0 }));
  let c = await me(u),
    m = [...c.warnings],
    d = [...c.skippedFiles],
    f = [],
    h = [],
    p = [],
    g = a && (t === 'pydantic' || t === 'all') ? new Map() : null,
    v = new Map(),
    k = new Map();
  for (let w of c.schemas) {
    let b = w.exportName;
    if (!v.has(b)) (v.set(b, w), k.set(b, w.file));
    else {
      let O = k.get(b);
      if (!O) {
        (v.set(b, w), k.set(b, w.file));
        continue;
      }
      if (y.basename(w.file) === 'index.ts' || y.basename(w.file) === 'index.js') continue;
      (y.basename(O) === 'index.ts' || y.basename(O) === 'index.js') &&
        (v.set(b, w), k.set(b, w.file));
    }
  }
  let x = new Map();
  for (let w of v.values()) {
    let b = x.get(w.file) || [];
    (b.push(w), x.set(w.file, b));
  }
  let j = new Map();
  for (let [w, b] of x.entries()) {
    if (b.length === 0) continue;
    let O = y.relative(u.sourceDir, w),
      W;
    if (o) {
      let A = y.dirname(O),
        ne = y.basename(w, y.extname(w));
      W = y.join(l, A, ne);
    } else W = l;
    for (let A of b) {
      let ne = t === 'all' ? ['pydantic', 'typescript'] : [t];
      for (let G of ne)
        try {
          let E = {
            preserveStructure: o,
            outputBasePath: W,
            sourceFile: w,
            outDir: l,
            usedNames: j,
          };
          (e.enumStyle !== void 0 && (E.enumStyle = e.enumStyle),
            e.enumBaseType !== void 0 && (E.enumBaseType = e.enumBaseType));
          let I = Sn(A, G, E),
            te = I.path;
          (p.push({ path: te, content: I.content, target: G }),
            g && G === 'pydantic' && Cn(g, te, I.symbolName),
            h.push({ path: te, sourceFile: w, exportName: A.exportName, target: G }));
        } catch (E) {
          let I = E instanceof Error ? E.message : String(E);
          f.push(`Failed to convert ${A.exportName} from ${w}: ${I}`);
        }
    }
  }
  if (g) {
    let w = Fn(l, g);
    for (let b of w) p.push({ path: b.path, content: b.content, target: 'pydantic' });
  }
  if (f.length > 0)
    return {
      files: h,
      warnings: m,
      skippedFiles: d,
      errors: f,
      written: 0,
      unchanged: 0,
      deleted: 0,
      outOfDate: 0,
    };
  let M = await Nn(p, { outDir: l, target: t, clean: i, verify: r });
  for (let w of h) {
    let b = M.actionByPath.get(y.resolve(w.path));
    b !== void 0 && (w.action = b);
  }
  return {
    files: h,
    warnings: m,
    skippedFiles: d,
    errors: f,
    written: M.written,
    unchanged: M.unchanged,
    deleted: M.deleted,
    outOfDate: M.outOfDate,
  };
}
function Sn(e, n, t) {
  let { schema: i, exportName: r } = e,
    {
      preserveStructure: o,
      outputBasePath: s,
      outDir: a,
      usedNames: u,
      enumStyle: l,
      enumBaseType: c,
    } = t,
    m = Mn(r),
    d = On(r),
    f = n === 'pydantic' ? '.py' : '.d.ts',
    h = o ? y.dirname(s) : a,
    p = `${d}${f}`,
    g = y.join(h, p),
    v = u.get(g) ?? 0;
  (v > 0 && ((p = `${d}_${v}${f}`), (g = y.join(h, p))), u.set(g, v + 1));
  let k;
  o ? (k = y.join(y.dirname(s), p)) : (k = y.join(a, p));
  let x = { name: m, sourceModule: e.file };
  (l !== void 0 && (x.enumStyle = l), c !== void 0 && (x.enumBaseType = c));
  let j = n === 'pydantic' ? ye(i, x) : he(i, x);
  return { path: k, content: j, symbolName: m };
}
async function Nn(e, n) {
  let t = 0,
    i = 0,
    r = 0,
    o = 0,
    s = new Map(),
    a = new Set(e.map((u) => y.resolve(u.path)));
  for (let u of e) {
    let l = y.resolve(u.path),
      c = ce(u.content, u.target),
      m = await H(l);
    if (m !== void 0 && B(m) === c) {
      (i++, s.set(l, 'unchanged'));
      continue;
    }
    if (n.verify) {
      (o++, s.set(l, 'outOfDate'));
      continue;
    }
    (await U.mkdir(y.dirname(l), { recursive: !0 }),
      await U.writeFile(l, c, 'utf8'),
      t++,
      s.set(l, 'written'));
  }
  if (n.clean) {
    let u = await Tn(n.outDir, a, n.target);
    if (n.verify) o += u.length;
    else for (let l of u) (await U.unlink(l), r++);
  }
  return { written: t, unchanged: i, deleted: r, outOfDate: o, actionByPath: s };
}
async function Tn(e, n, t) {
  let i = [];
  async function r(o) {
    let s;
    try {
      s = (await U.readdir(o, { withFileTypes: !0 })).sort((a, u) => fe(a.name, u.name));
    } catch (a) {
      if ($n(a) && a.code === 'ENOENT') return;
      throw a;
    }
    for (let a of s) {
      let u = y.join(o, a.name);
      if (a.isDirectory()) {
        await r(u);
        continue;
      }
      if (!a.isFile()) continue;
      let l = y.resolve(u);
      if (n.has(l) || !En(l, t)) continue;
      let c = await H(l);
      c !== void 0 && Ze(l, c) && i.push(l);
    }
  }
  return (await r(e), i);
}
function En(e, n) {
  let t = n === 'all' ? ['pydantic', 'typescript'] : [n];
  return (
    (t.includes('pydantic') && e.endsWith('.py')) ||
    (t.includes('typescript') && e.endsWith('.d.ts'))
  );
}
function fe(e, n) {
  return e < n ? -1 : e > n ? 1 : 0;
}
function $n(e) {
  return e instanceof Error && 'code' in e;
}
function Cn(e, n, t) {
  let i = y.dirname(n),
    r = y.basename(n, y.extname(n)),
    o = e.get(i) ?? [];
  (o.push({ moduleName: r, symbolNames: [t] }), e.set(i, o));
}
function Fn(e, n) {
  let t = Pn(e, n);
  t.has(e) || t.add(e);
  let r = jn(e, t, n).get(e);
  if (!r) return [];
  let o = new Map(),
    s = (a) => {
      let u = [],
        l = [],
        c = [...a.modules].sort((p, g) => fe(p.moduleName, g.moduleName));
      for (let p of c) {
        let g = p.symbolNames.join(', ');
        (u.push(`from .${p.moduleName} import ${g}`), l.push(...p.symbolNames));
      }
      let m = [...a.children].sort((p, g) => fe(y.basename(p.path), y.basename(g.path)));
      for (let p of m) {
        let g = s(p);
        if (g.length === 0) continue;
        let v = y.basename(p.path);
        (u.push(`from .${v} import ${g.join(', ')}`), l.push(...g));
      }
      let d = [],
        f = new Set();
      for (let p of l) f.has(p) || (f.add(p), d.push(p));
      let h = '';
      if (
        (u.length > 0 &&
          (h += `${u.join(`
`)}

`),
        d.length > 0)
      ) {
        let p = d.map((g) => `"${g}"`).join(', ');
        h += `__all__ = [${p}]
`;
      }
      return (o.set(a.path, h), d);
    };
  return (s(r), [...o.entries()].map(([a, u]) => ({ path: y.join(a, '__init__.py'), content: u })));
}
function Pn(e, n) {
  let t = new Set();
  for (let i of n.keys()) {
    t.add(i);
    let r = i;
    for (;;) {
      let o = Le(r, e);
      if (!o) break;
      if (t.has(o)) {
        r = o;
        continue;
      }
      (t.add(o), (r = o));
    }
  }
  return t;
}
function jn(e, n, t) {
  let i = new Map(),
    r = (o) => {
      let s = i.get(o);
      return (
        s || ((s = { path: o, modules: t.get(o) ?? [], children: new Set() }), i.set(o, s)),
        s
      );
    };
  for (let o of n) r(o);
  for (let o of n) {
    let s = Le(o, e);
    if (!s) continue;
    let a = r(s),
      u = r(o);
    a !== u && a.children.add(u);
  }
  return i;
}
function Le(e, n) {
  if (e === n) return null;
  let t = y.dirname(e);
  return !t || t === e || !t.startsWith(n) ? null : t;
}
function Mn(e) {
  return (
    e
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
      .join('') || 'Model'
  );
}
function On(e) {
  return e
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}
function ye(e, n) {
  let { node: t, warnings: i } = ue(e),
    r = { name: n.name, warnings: i };
  return (
    n.sourceModule !== void 0 && (r.sourceModule = n.sourceModule),
    n.enumStyle !== void 0 && (r.enumStyle = n.enumStyle),
    n.enumBaseType !== void 0 && (r.enumBaseType = n.enumBaseType),
    t.type === 'enum' ? xe(t, r) : t.type === 'object' ? ke(t, r) : Se(t, r)
  );
}
function he(e, n) {
  let { node: t, warnings: i } = ue(e),
    r = { name: n.name, warnings: i };
  return (
    n.sourceModule !== void 0 && (r.sourceModule = n.sourceModule),
    n.exportNameOverrides !== void 0 && (r.exportNameOverrides = n.exportNameOverrides),
    t.type === 'enum' ? oe(t, r) : t.type === 'object' ? Fe(t, r) : Pe(t, r)
  );
}
function Be(e) {
  let { schema: n, target: t, out: i, ...r } = e,
    o = [],
    s = r.name,
    a = i ? P.resolve(i) : void 0,
    u = (c) => (c === 'pydantic' ? '.py' : '.d.ts');
  if (t === 'all') {
    if (a && P.extname(a))
      return Promise.reject(
        new Error(
          'When target is "all", --out must be a directory or omitted. Received a file path with extension.',
        ),
      );
    let c = a ?? process.cwd();
    o.push(
      { target: 'pydantic', path: P.join(c, `${s}${u('pydantic')}`) },
      { target: 'typescript', path: P.join(c, `${s}${u('typescript')}`) },
    );
  } else
    a
      ? P.extname(a)
        ? o.push({ target: t, path: a })
        : o.push({ target: t, path: `${a}${u(t)}` })
      : o.push({ target: t, path: P.join(process.cwd(), `${s}${u(t)}`) });
  let l = o.map(async (c) => {
    let m = c.target === 'pydantic' ? ye(n, r) : he(n, r),
      d = await Ie(c.path, m, c.target);
    return { path: c.path, target: c.target, action: d };
  });
  return Promise.all(l);
}
var De = `
Usage:
  schemabridge convert zod <input-file> --export <schema-name> [--to pydantic|typescript|all] [--out <path>] [--allow-unresolved] [--enum-style enum|literal] [--enum-base-type str|int]
  schemabridge convert folder <source-dir> --out <output-dir> [--to pydantic|typescript|all] [--flat] [--init] [--clean] [--verify] [--export-pattern <pattern>] [--allow-unresolved] [--enum-style enum|literal] [--enum-base-type str|int]

Commands:
  convert zod    Convert a single Zod schema from a file
  convert folder Convert all Zod schemas in a folder recursively

Examples:
  # Convert single schema
  schemabridge convert zod input.ts --export enrichedTransactionSchema --to pydantic --out model.py
  
  # Convert standalone enum
  schemabridge convert zod enums.ts --export statusEnum --to pydantic --out status.py
  
  # Convert with enum options
  schemabridge convert zod input.ts --export schema --to pydantic --out model.py --enum-style literal --enum-base-type str
  
  # Convert all schemas in a folder (preserves structure)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic
  
  # Convert all schemas to flat output structure
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --flat
  
  # Generate __init__.py files for Python packages
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --init

  # Verify generated files are current without writing
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --verify

  # Only convert exports whose names match a pattern (e.g. *Schema)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --export-pattern '*Schema'
`.trim();
async function In(e = ve.argv.slice(2)) {
  try {
    let n = Zn(e);
    if (n.mode === 'folder') {
      let s = await ge({
        sourceDir: n.sourceDir,
        outDir: n.out,
        target: n.target,
        preserveStructure: !n.flat,
        generateInitFiles: n.generateInitFiles,
        clean: n.clean,
        verify: n.verify,
        registerTsLoader: !0,
        trustedInput: !0,
        allowUnresolved: n.allowUnresolved,
        ...(n.exportNamePattern !== void 0 && { exportNamePattern: n.exportNamePattern }),
        ...(n.tsconfigPath !== void 0 && { tsconfigPath: n.tsconfigPath }),
        ...(n.enumStyle !== void 0 && { enumStyle: n.enumStyle }),
        ...(n.enumBaseType !== void 0 && { enumBaseType: n.enumBaseType }),
      });
      for (let a of s.warnings) console.warn(`Warning: ${a}`);
      s.skippedFiles.length > 0 &&
        console.warn(`Skipped ${s.skippedFiles.length} files (no schemas found)`);
      for (let a of s.errors) console.error(`Error: ${a}`);
      for (let a of s.files.filter((u) => u.action === 'written'))
        console.log(`Wrote ${a.target}: ${a.path}`);
      return (
        s.deleted > 0 && console.log(`Deleted ${s.deleted} stale generated file(s).`),
        console.log(`
Sync summary: written ${s.written}, unchanged ${s.unchanged}, deleted ${s.deleted}, out of date ${s.outOfDate}.`),
        s.errors.length > 0
          ? 1
          : n.verify && s.outOfDate > 0
            ? (console.error(`Generated files are out of date (${s.outOfDate}).`), 1)
            : 0
      );
    }
    let { schema: t, warnings: i } = await pe({
      file: n.inputFile,
      exportName: n.exportName,
      registerTsLoader: !0,
      trustedInput: !0,
      ...(n.tsconfigPath !== void 0 && { tsconfigPath: n.tsconfigPath }),
      allowUnresolved: n.allowUnresolved,
    });
    for (let s of i) console.warn(`Warning: ${s}`);
    let r = {
      schema: t,
      name: n.exportName,
      target: n.target,
      allowUnresolved: n.allowUnresolved,
      sourceModule: n.inputFile,
    };
    (n.out !== void 0 && (r.out = n.out),
      n.enumStyle !== void 0 && (r.enumStyle = n.enumStyle),
      n.enumBaseType !== void 0 && (r.enumBaseType = n.enumBaseType));
    let o = await Be(r);
    for (let s of o) {
      let a = s.action === 'unchanged' ? 'Unchanged' : 'Wrote';
      console.log(`${a} ${s.target}: ${s.path}`);
    }
    return 0;
  } catch (n) {
    let t = n instanceof N || n instanceof Error ? n.message : String(n);
    return (console.error(`Error: ${t}`), console.error(De), 1);
  }
}
function Zn(e) {
  if (e.length === 0 || e.includes('--help') || e.includes('-h')) throw new Error(De);
  let [n, t, ...i] = e;
  if (n !== 'convert') throw new Error('Expected command: convert zod|folder ...');
  if (t === 'folder') return _n(i);
  if (t !== 'zod')
    throw new Error('Expected command: convert zod <input-file> or convert folder <source-dir>');
  return Rn(i);
}
function Rn(e) {
  if (e.length === 0) throw new Error('Missing <input-file>');
  let n = e[0];
  if (!n) throw new Error('Missing <input-file>');
  let t,
    i = 'pydantic',
    r,
    o = !1,
    s,
    a,
    u;
  for (let c = 1; c < e.length; c++) {
    let m = e[c];
    if (m)
      switch (m) {
        case '--export': {
          let d = e[++c];
          if (!d || d.startsWith('-'))
            throw new Error('--export requires a value: --export <schema-name>');
          t = d;
          break;
        }
        case '--to': {
          let d = e[++c];
          if (!d || d.startsWith('-'))
            throw new Error('--to requires a value: --to pydantic|typescript|all');
          if (d !== 'pydantic' && d !== 'typescript' && d !== 'all')
            throw new Error('Invalid --to value. Expected "pydantic", "typescript", or "all".');
          i = d;
          break;
        }
        case '--out': {
          let d = e[++c];
          if (!d || d.startsWith('-')) throw new Error('--out requires a value: --out <path>');
          r = d;
          break;
        }
        case '--allow-unresolved':
          o = !0;
          break;
        case '--tsconfig': {
          let d = e[++c];
          if (!d || d.startsWith('-'))
            throw new Error('--tsconfig requires a value: --tsconfig <path>');
          s = d;
          break;
        }
        case '--enum-style': {
          let d = e[++c];
          if (!d || d.startsWith('-'))
            throw new Error('--enum-style requires a value: --enum-style enum|literal');
          if (d !== 'enum' && d !== 'literal')
            throw new Error('Invalid --enum-style value. Expected "enum" or "literal".');
          a = d;
          break;
        }
        case '--enum-base-type': {
          let d = e[++c];
          if (!d || d.startsWith('-'))
            throw new Error('--enum-base-type requires a value: --enum-base-type str|int');
          if (d !== 'str' && d !== 'int')
            throw new Error('Invalid --enum-base-type value. Expected "str" or "int".');
          u = d;
          break;
        }
        default:
          throw m.startsWith('-')
            ? new Error(`Unknown option: ${m}`)
            : new Error(`Unexpected argument: ${m}`);
      }
  }
  if (!t) throw new Error('Missing required --export <schema-name>');
  let l = {
    mode: 'file',
    inputFile: z.resolve(n),
    exportName: t,
    target: i,
    allowUnresolved: o,
    ...(s !== void 0 && { tsconfigPath: s }),
    ...(a !== void 0 && { enumStyle: a }),
    ...(u !== void 0 && { enumBaseType: u }),
  };
  return (r !== void 0 && (l.out = r), l);
}
function _n(e) {
  if (e.length === 0) throw new Error('Missing <source-dir>');
  let n = e[0];
  if (!n) throw new Error('Missing <source-dir>');
  let t = 'pydantic',
    i,
    r = !1,
    o = !1,
    s = !1,
    a = !1,
    u = !1,
    l,
    c,
    m,
    d;
  for (let f = 1; f < e.length; f++) {
    let h = e[f];
    if (h)
      switch (h) {
        case '--to': {
          let p = e[++f];
          if (!p || p.startsWith('-'))
            throw new Error('--to requires a value: --to pydantic|typescript|all');
          if (p !== 'pydantic' && p !== 'typescript' && p !== 'all')
            throw new Error('Invalid --to value. Expected "pydantic", "typescript", or "all".');
          t = p;
          break;
        }
        case '--out': {
          let p = e[++f];
          if (!p || p.startsWith('-'))
            throw new Error('--out requires a value: --out <output-dir>');
          i = p;
          break;
        }
        case '--allow-unresolved':
          r = !0;
          break;
        case '--flat':
          o = !0;
          break;
        case '--init':
          s = !0;
          break;
        case '--clean':
          a = !0;
          break;
        case '--verify':
          u = !0;
          break;
        case '--export-pattern': {
          let p = e[++f];
          if (!p || p.startsWith('-'))
            throw new Error("--export-pattern requires a value, e.g. --export-pattern '*Schema'");
          l = p;
          break;
        }
        case '--tsconfig': {
          let p = e[++f];
          if (!p || p.startsWith('-'))
            throw new Error('--tsconfig requires a value: --tsconfig <path>');
          c = p;
          break;
        }
        case '--enum-style': {
          let p = e[++f];
          if (!p || p.startsWith('-'))
            throw new Error('--enum-style requires a value: --enum-style enum|literal');
          if (p !== 'enum' && p !== 'literal')
            throw new Error('Invalid --enum-style value. Expected "enum" or "literal".');
          m = p;
          break;
        }
        case '--enum-base-type': {
          let p = e[++f];
          if (!p || p.startsWith('-'))
            throw new Error('--enum-base-type requires a value: --enum-base-type str|int');
          if (p !== 'str' && p !== 'int')
            throw new Error('Invalid --enum-base-type value. Expected "str" or "int".');
          d = p;
          break;
        }
        default:
          throw h.startsWith('-')
            ? new Error(`Unknown option: ${h}`)
            : new Error(`Unexpected argument: ${h}`);
      }
  }
  if (!i) throw new Error('Missing required --out <output-dir>');
  return {
    mode: 'folder',
    sourceDir: z.resolve(n),
    out: z.resolve(i),
    target: t,
    allowUnresolved: r,
    flat: o,
    generateInitFiles: s,
    clean: a,
    verify: u,
    ...(l !== void 0 && { exportNamePattern: l }),
    ...(c !== void 0 && { tsconfigPath: c }),
    ...(m !== void 0 && { enumStyle: m }),
    ...(d !== void 0 && { enumBaseType: d }),
  };
}
z.resolve(An(import.meta.url)) === z.resolve(ve.argv[1] ?? '') &&
  In().then((e) => {
    e !== 0 && ve.exit(e);
  });
export { In as runCLI };
