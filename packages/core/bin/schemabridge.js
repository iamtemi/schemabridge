#!/usr/bin/env node
import { fileURLToPath as yn } from 'node:url';
import I from 'node:path';
import ae from 'node:process';
import Se from 'node:fs/promises';
import $ from 'node:path';
function ce(e, n) {
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
    i = me(e, n.name, t, []),
    r = ge(t),
    s = Me(t),
    o = Ze(t);
  return [r, s, o, i].filter(Boolean).join(`

`);
}
function de(e, n) {
  if (e.type !== 'enum')
    throw new Error('Root schema must be an enum to generate Pydantic Enum class.');
  if ((n.enumStyle ?? 'enum') === 'literal') {
    let s = e.values.map((o) => C(o));
    return ['from typing import Literal', '', `type ${P(n.name)} = Literal[${s.join(', ')}]`].join(`
`);
  }
  let i = P(n.name);
  return ['from enum import Enum', '', ye(i, e.values, n.enumBaseType ?? 'str')].join(`
`);
}
function pe(e, n) {
  let t = {
      typingImports: new Set(),
      pydanticImports: new Set(),
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
    i = P(n.name),
    r = L(e, t, [], i);
  return [ge(t), `type ${i} = ${r.annotation}`].filter(Boolean).join(`

`);
}
function me(e, n, t, i) {
  if (e.type !== 'object') throw new Error(`Cannot render non-object node as class "${n}"`);
  let r = B(i.join('.') || n, n, t, i),
    s = [];
  for (let [l, c] of Object.entries(e.fields))
    R(c, [...i, l], (m, d) => {
      let p = d.join('.');
      if (t.renderedPaths.has(p)) return;
      t.renderedPaths.add(p);
      let b = B(p, d[d.length - 1] ?? 'Model', t, d, n);
      s.push(me(m, b, t, d));
    });
  let o = [];
  for (let [l, c] of Object.entries(e.fields)) o.push(Ee(l, c, t, [...i, l], n));
  let a = (l) => (l.length === 0 ? '' : `    ${l}`),
    u = [];
  for (let l of [...s, ...(o.length ? o : ['pass'])])
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
function Ee(e, n, t, i, r) {
  let { annotation: s, defaultCode: o, optional: a } = L(n, t, i, r),
    { name: u, alias: l } = Ie(e),
    c = o;
  return (
    l && ((c = _e(c, l, a ?? !1)), t.pydanticImports.add('Field')),
    c !== void 0 ? `${u}: ${s} = ${c}` : `${u}: ${s}`
  );
}
function L(e, n, t, i) {
  let { inner: r, optional: s, nullable: o, defaultValue: a } = fe(e),
    u = $e(r, n, t, i),
    l = u.annotation;
  (o && (n.typingImports.add('Optional'), (l = `Optional[${l}]`)),
    s && (n.typingImports.add('Optional'), (l = `Optional[${l}]`)));
  let c = { annotation: l };
  return a !== void 0
    ? ((c.defaultCode = Ce(a, n)), c)
    : s
      ? ((c.defaultCode = 'None'), c)
      : (u.defaultCode !== void 0 && (c.defaultCode = u.defaultCode), (c.optional = s), c);
}
function $e(e, n, t, i) {
  switch (e.type) {
    case 'string': {
      let r = e.constraints;
      if (r) {
        n.pydanticImports.add('constr');
        let s = [];
        if (
          (r.length !== void 0
            ? s.push(`min_length=${r.length}`, `max_length=${r.length}`)
            : (r.minLength !== void 0 && s.push(`min_length=${r.minLength}`),
              r.maxLength !== void 0 && s.push(`max_length=${r.maxLength}`)),
          r.regex !== void 0)
        ) {
          let o = Pe(r.regex, t, n);
          s.push(`pattern=${o}`);
        }
        return { annotation: `constr(${s.join(', ')})` };
      }
      return { annotation: 'str' };
    }
    case 'number': {
      let r = e.constraints;
      return r
        ? (n.pydanticImports.add('confloat'), { annotation: `confloat(${ue(r).join(', ')})` })
        : { annotation: 'float' };
    }
    case 'int': {
      let r = e.constraints;
      n.pydanticImports.add('conint');
      let s = r ? ue(r) : [];
      return { annotation: s.length ? `conint(${s.join(', ')})` : 'conint()' };
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
      let r = e.values.slice().sort().join('|'),
        s = n.enumClasses.get(r);
      if (s) return { annotation: s.name };
      let o = t.length > 0 ? `${t.join('.')}.Enum` : 'Enum',
        a = t[t.length - 1],
        u = B(o, a ? `${P(a)}Enum` : 'Enum', n, [...t, 'Enum'], i),
        l = { name: u, values: e.values, baseType: n.enumBaseType };
      return (n.enumClasses.set(r, l), n.enumClassesToRender.push(l), { annotation: u });
    }
    case 'literal':
      return (n.typingImports.add('Literal'), { annotation: `Literal[${C(e.value)}]` });
    case 'array': {
      n.typingImports.add('List');
      let r = L(e.element, n, [...t, '[item]'], i),
        s = { annotation: `List[${r.annotation}]` };
      return (r.defaultCode !== void 0 && (s.defaultCode = r.defaultCode), s);
    }
    case 'union':
      return (
        n.typingImports.add('Union'),
        {
          annotation: `Union[${e.options.map((s, o) => L(s, n, [...t, `option${o}`], i).annotation).join(', ')}]`,
        }
      );
    case 'object':
      return { annotation: B(t.join('.'), t[t.length - 1] ?? i, n, t, i) };
    case 'any':
    case 'unknown':
      return (n.typingImports.add('Any'), { annotation: 'Any' });
    case 'reference':
      return { annotation: e.name };
    default:
      return (n.typingImports.add('Any'), { annotation: 'Any' });
  }
}
function ue(e) {
  let n = [];
  return (
    e.min && n.push(`${e.min.inclusive ? 'ge' : 'gt'}=${e.min.value}`),
    e.max && n.push(`${e.max.inclusive ? 'le' : 'lt'}=${e.max.value}`),
    e.positive && !e.min && n.push('gt=0'),
    e.nonnegative && !e.min && n.push('ge=0'),
    n
  );
}
function fe(e) {
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
function Ce(e, n) {
  return (
    n.pydanticImports.add('Field'),
    Array.isArray(e)
      ? 'Field(default_factory=list)'
      : e && typeof e == 'object'
        ? 'Field(default_factory=dict)'
        : `Field(default=${C(e)})`
  );
}
function Pe(e, n, t) {
  let i = Fe(e),
    r = t.regexConstants.get(i);
  if (r) return r;
  if (typeof e == 'object' && e instanceof RegExp) {
    let a = ['i', 'm', 's'],
      u = e.flags.split('').filter((l) => !a.includes(l) && l !== 'u' && l !== 'g');
    u.length > 0 &&
      t.warnings.push({
        code: 'unsupported_effect',
        path: n,
        message: `Regex flags "${u.join('')}" are not mapped to Python. Only i/m/s are embedded inline; u is default in Python, g is irrelevant.`,
      });
  }
  let o = `${Re([...n].pop() ?? 'pattern')}_REGEX`;
  return (t.regexConstants.set(i, o), t.regexOrder.push(i), o);
}
function Fe(e) {
  return typeof e == 'string' ? e : `/${e.source}/${e.flags}`;
}
function je(e) {
  if (typeof e == 'string') return le(e);
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
  return le(t + e.source);
}
function Me(e) {
  return e.regexOrder.length
    ? e.regexOrder.map((t) => {
        let i = e.regexConstants.get(t);
        if (!i) throw new Error(`Missing regex constant for key: ${t}`);
        return `${i} = ${je(t.startsWith('/') ? new RegExp(t.slice(1, t.lastIndexOf('/')), t.slice(t.lastIndexOf('/') + 1)) : t)}`;
      }).join(`
`)
    : '';
}
function ge(e) {
  let n = [],
    t = Array.from(e.pydanticImports).sort();
  t.length && n.push(`from pydantic import ${t.join(', ')}`);
  let i = Array.from(e.typingImports).sort();
  (i.length && n.push(`from typing import ${i.join(', ')}`),
    e.enumClassesToRender.length > 0 && n.push('from enum import Enum'));
  let r = [];
  (e.needsDate && r.push('date'),
    e.needsDatetime && r.push('datetime'),
    e.needsTime && r.push('time'),
    e.needsTimedelta && r.push('timedelta'),
    r.length && n.push(`from datetime import ${r.join(', ')}`),
    e.needsUUID && n.push('from uuid import UUID'));
  let s = [];
  return (
    e.needsIPv4 && s.push('IPv4Address'),
    e.needsIPv6 && s.push('IPv6Address'),
    s.length && n.push(`from ipaddress import ${s.join(', ')}`),
    n.join(`
`)
  );
}
function ye(e, n, t) {
  let i = n.map((r) => {
    let s = Oe(r),
      o = U(r);
    return `    ${s} = ${o}`;
  });
  return [`class ${e}(${t}, Enum):`, ...i].join(`
`);
}
function Ze(e) {
  return e.enumClassesToRender.length === 0
    ? ''
    : e.enumClassesToRender.map((n) => ye(n.name, n.values, n.baseType)).join(`

`);
}
function Oe(e) {
  return (
    e
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'VALUE'
  );
}
function C(e) {
  switch (typeof e) {
    case 'string':
      return U(e);
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
              .map(([n, t]) => `${U(n)}: ${C(t)}`)
              .join(', ') +
            '}';
    default:
      return 'None';
  }
}
function U(e) {
  return `"${e.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
function le(e) {
  return `r"${e.replace(/"/g, '\\"')}"`;
}
function Ie(e) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(e)
    ? { name: e }
    : {
        name:
          e
            .replace(/[^A-Za-z0-9_]/g, '_')
            .replace(/^[^A-Za-z_]+/, (i) => `_${i}`)
            .replace(/_+/g, '_') || '_field',
        alias: e,
      };
}
function _e(e, n, t) {
  let i = `alias=${U(n)}`;
  if (e?.startsWith('Field(')) {
    let r = e.slice(6, e.length - 1).trim();
    return `Field(${(r ? [i, r] : [i]).join(', ')})`;
  }
  return e !== void 0
    ? `Field(${i}, default=${e})`
    : t
      ? `Field(${i}, default=None)`
      : `Field(${i}, default=...)`;
}
function B(e, n, t, i, r) {
  let s = t.pathNameMap.get(e);
  if (s) return s;
  let o = Ae(i, n, r),
    a = t.nameCounts.get(o) ?? 0,
    u = a === 0 ? o : `${o}${a + 1}`;
  return (t.nameCounts.set(o, a + 1), t.pathNameMap.set(e, u), u);
}
function Ae(e, n, t) {
  let i = e
    .filter(Boolean)
    .map((r) => (r === '[item]' ? 'Item' : (/^option\d+$/i.test(r), r)))
    .filter((r) => r !== '');
  return i.length === 0 ? P(n || t || 'Model') : P(i.join(' '));
}
function P(e) {
  return (
    e
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
      .join('') || 'Model'
  );
}
function Re(e) {
  return e
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();
}
function R(e, n, t) {
  let { inner: i } = fe(e);
  if (i.type === 'object') {
    t(i, n);
    for (let [r, s] of Object.entries(i.fields)) R(s, [...n, r], t);
    return;
  }
  if (i.type === 'array') {
    R(i.element, [...n, '[item]'], t);
    return;
  }
  i.type === 'union' && i.options.forEach((r, s) => R(r, [...n, `option${s}`], t));
}
function he(e, n) {
  let t = {
    renderedPaths: new Set(),
    warnings: n.warnings ?? [],
    exportNameOverrides: new Map(Object.entries(n.exportNameOverrides ?? {})),
    pathNameMap: new Map(),
    nameCounts: new Map(),
  };
  if (e.type === 'enum') return Q(e, n);
  if (e.type !== 'object')
    throw new Error('Root schema must be a Zod object or enum to generate TypeScript definitions.');
  return H(e, n.name, t, []);
}
function Q(e, n) {
  if (e.type !== 'enum')
    throw new Error('Root schema must be an enum to generate TypeScript enum type.');
  let t = V(n.name),
    r = e.values.map((s) => M(s)).join(' | ');
  return `export type ${t} = ${r};`;
}
function ve(e, n) {
  let t = {
      renderedPaths: new Set(),
      warnings: n.warnings ?? [],
      exportNameOverrides: new Map(Object.entries(n.exportNameOverrides ?? {})),
      pathNameMap: new Map(),
      nameCounts: new Map(),
    },
    i = V(n.name),
    r = D(e, t, [], i, !1);
  return `export type ${i} = ${r.typeAnnotation};`;
}
function H(e, n, t, i) {
  if (e.type !== 'object') throw new Error(`Cannot render non-object node as interface "${n}"`);
  let r = z(i.join('.') || n, n, t, i),
    s = [];
  for (let [d, p] of Object.entries(e.fields)) {
    let { inner: b } = Y(p);
    if (b.type === 'object') {
      let f = [...i, d],
        g = f.join('.');
      if (!t.renderedPaths.has(g)) {
        t.renderedPaths.add(g);
        let w = z(f.join('.'), d, t, f, r);
        s.push(H(b, w, t, f));
      }
    } else
      W(p, [...i, d], (f, g) => {
        let w = g.join('.');
        if (t.renderedPaths.has(w)) return;
        t.renderedPaths.add(w);
        let y = z(w, g[g.length - 1] ?? 'Model', t, g, r);
        s.push(H(f, y, t, g));
      });
  }
  let o = [];
  for (let [d, p] of Object.entries(e.fields)) o.push(Le(d, p, t, [...i, d], r));
  let a = (d) => (d.length === 0 ? '' : `  ${d}`),
    u = [];
  for (let d of o.length ? o : []) u.push(a(d));
  let l =
      u.length > 0
        ? ` {
${u.join(`
`)}
}`
        : ' {}',
    c = `export interface ${r}${l}`;
  return [...s, c].join(`

`);
}
function Le(e, n, t, i, r) {
  let { typeAnnotation: s, isOptional: o } = D(n, t, i, r, !0),
    a = o ? '?' : '';
  return `${Be(e)}${a}: ${s};`;
}
function D(e, n, t, i, r) {
  let { inner: s, optional: o, nullable: a, nullish: u } = Y(e),
    l = Ue(s, n, t, i),
    c = l,
    m = !1;
  return (
    r
      ? u
        ? ((m = !0), (c = `${l} | null`))
        : o && a
          ? ((m = !0), (c = `${l} | null`))
          : o
            ? ((m = !0), (c = l))
            : a && (c = `${l} | null`)
      : u
        ? (c = `${l} | null | undefined`)
        : o && a
          ? (c = `${l} | null | undefined`)
          : o
            ? (c = `${l} | undefined`)
            : a && (c = `${l} | null`),
    { typeAnnotation: c, isOptional: m }
  );
}
function Ue(e, n, t, i) {
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
      return e.values.map((s) => M(s)).join(' | ');
    case 'literal':
      return M(e.value);
    case 'array': {
      let r = D(e.element, n, [...t, '[item]'], i, !1);
      return `${r.typeAnnotation.includes(' | ') ? `(${r.typeAnnotation})` : r.typeAnnotation}[]`;
    }
    case 'union':
      return e.options
        .map((s, o) => D(s, n, [...t, `option${o}`], i, !1))
        .map((s) => s.typeAnnotation)
        .join(' | ');
    case 'object': {
      let r = t.join('.');
      return n.exportNameOverrides.get(r) ?? z(t.join('.'), t[t.length - 1] ?? i, n, t, i);
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
function Y(e) {
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
function M(e) {
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
          ? `[${e.map((n) => M(n)).join(', ')}]`
          : '{ ' +
            Object.entries(e)
              .map(([n, t]) => `${JSON.stringify(n)}: ${M(t)}`)
              .join(', ') +
            ' }';
    default:
      return 'any';
  }
}
function V(e) {
  return (
    e
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
      .join('') || 'Model'
  );
}
function Be(e) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(e) ? e : JSON.stringify(e);
}
function z(e, n, t, i, r) {
  let s = t.exportNameOverrides.get(e);
  if (s) return (t.pathNameMap.set(e, s), s);
  let o = t.pathNameMap.get(e);
  if (o) return o;
  let a = ze(i, n, r),
    u = t.nameCounts.get(a) ?? 0,
    l = u === 0 ? a : `${a}${u + 1}`;
  return (t.nameCounts.set(a, u + 1), t.pathNameMap.set(e, l), l);
}
function ze(e, n, t) {
  let i = e
    .filter(Boolean)
    .map((r) => (r === '[item]' ? 'Item' : (/^option\d+$/i.test(r), r)))
    .filter((r) => r !== '');
  return i.length === 0 ? V(n || t || 'Model') : V(i.join(' '));
}
function W(e, n, t) {
  let { inner: i } = Y(e);
  if (i.type === 'object') {
    t(i, n);
    for (let [r, s] of Object.entries(i.fields)) W(s, [...n, r], t);
    return;
  }
  if (i.type === 'array') {
    W(i.element, [...n, '[item]'], t);
    return;
  }
  i.type === 'union' && i.options.forEach((r, s) => W(r, [...n, `option${s}`], t));
}
function ee(e, n = []) {
  let t = [];
  return { node: k(e, n, t), warnings: t };
}
function k(e, n, t) {
  let i = De(e);
  if (!i || typeof i != 'object') throw new Error('Invalid Zod schema definition');
  let r = i,
    s = Ve(r);
  switch (s) {
    case 'optional':
    case 'ZodOptional': {
      let o = r.innerType;
      return { type: 'optional', inner: k(o, n, t) };
    }
    case 'nullable':
    case 'ZodNullable': {
      let o = r.innerType;
      return { type: 'nullable', inner: k(o, n, t) };
    }
    case 'nullish':
    case 'ZodNullish': {
      let o = r.innerType;
      return { type: 'nullish', inner: k(o, n, t) };
    }
    case 'default':
    case 'ZodDefault': {
      let o = r.innerType;
      return {
        type: 'default',
        defaultValue: typeof r.defaultValue == 'function' ? r.defaultValue() : r.defaultValue,
        inner: k(o, n, t),
      };
    }
    case 'effects':
    case 'ZodEffects': {
      let o = r.effect?.type ?? r.effects?.[0]?.type;
      t.push({
        code: 'unsupported_effect',
        path: n,
        message: `Encountered Zod effect${o ? ` "${o}"` : ''}; using base schema shape.`,
      });
      let a = r.schema ?? r.innerType;
      return k(a, n, t);
    }
    case 'pipe': {
      t.push({
        code: 'unsupported_effect',
        path: n,
        message: 'Encountered Zod pipeline; using input schema shape.',
      });
      let o = r.in ?? r.schema;
      return k(o, n, t);
    }
  }
  switch (s) {
    case 'string':
    case 'ZodString': {
      let { constraints: o, inferredType: a } = qe(r);
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
                    : o
                      ? { type: 'string', constraints: o }
                      : { type: 'string' };
    }
    case 'number':
    case 'ZodNumber': {
      let { constraints: o, isInt: a } = Ge(r);
      return a
        ? o
          ? { type: 'int', constraints: o }
          : { type: 'int' }
        : o
          ? { type: 'number', constraints: o }
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
      let o = 'value' in r ? r.value : void 0,
        a = 'values' in r && Array.isArray(r.values) ? r.values[0] : void 0,
        u = 'values' in r && r.values instanceof Set ? r.values.values().next().value : void 0;
      return { type: 'literal', value: o ?? a ?? u };
    }
    case 'null':
    case 'ZodNull':
      return { type: 'literal', value: null };
    case 'object':
    case 'ZodObject': {
      let o = r.shape,
        a = typeof o == 'function' ? o() : o,
        u = {};
      for (let [l, c] of Object.entries(a)) u[l] = k(c, [...n, l], t);
      return { type: 'object', fields: u };
    }
    case 'array':
    case 'ZodArray': {
      let o = r.element ?? (r.type !== 'array' ? r.type : void 0) ?? r.elementType ?? r.items;
      if (!o) throw new Error('Array schema missing element type');
      return { type: 'array', element: k(o, [...n, '[element]'], t) };
    }
    case 'union':
    case 'ZodUnion':
      return {
        type: 'union',
        options: (r.options || []).map((a, u) => k(a, [...n, `option${u}`], t)),
      };
    case 'ZodDiscriminatedUnion': {
      let o = r.options ?? r.optionsMap;
      return {
        type: 'union',
        options: (o ? Array.from(o.values()) : []).map((u, l) => k(u, [...n, `option${l}`], t)),
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
          message: `Unknown or unsupported Zod schema type "${String(s)}"; defaulting to 'any'.`,
        }),
        { type: 'any' }
      );
  }
}
function We(e) {
  return typeof e == 'object' && e !== null && '_zod' in e;
}
function De(e) {
  return We(e) ? e._zod.def : e._def;
}
function Ve(e) {
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
function qe(e) {
  let n = e.checks || [],
    t = {},
    i;
  for (let s of n) {
    let o = we(s);
    if (o)
      switch (o.kind) {
        case 'min':
          t.minLength = o.value;
          break;
        case 'max':
          t.maxLength = o.value;
          break;
        case 'length':
          t.length = o.value;
          break;
        case 'regex':
          t.regex = o.regex;
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
    let s = we(e);
    if (s)
      switch (s.kind) {
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
          t.regex = s.regex;
          break;
        case 'min':
          t.minLength = s.value;
          break;
        case 'max':
          t.maxLength = s.value;
          break;
        case 'length':
          t.length = s.value;
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
function Ge(e) {
  let n = e.checks || [],
    t = {},
    i = !1;
  for (let s of n) {
    let o = be(s);
    if (o)
      switch (o.kind) {
        case 'min':
          ((t.min = { value: o.value, inclusive: o.inclusive ?? !0 }),
            t.min.value === 0 && t.min.inclusive === !1 && (t.positive = !0),
            t.min.value === 0 && t.min.inclusive === !0 && (t.nonnegative = !0));
          break;
        case 'max':
          t.max = { value: o.value, inclusive: o.inclusive ?? !0 };
          break;
        case 'int':
          i = !0;
          break;
      }
  }
  if (n.length === 0 && e.check) {
    let s = be(e);
    if (s)
      switch (s.kind) {
        case 'int':
          i = !0;
          break;
        case 'min':
          ((t.min = { value: s.value, inclusive: s.inclusive ?? !0 }),
            t.min.value === 0 && t.min.inclusive === !1 && (t.positive = !0),
            t.min.value === 0 && t.min.inclusive === !0 && (t.nonnegative = !0));
          break;
        case 'max':
          t.max = { value: s.value, inclusive: s.inclusive ?? !0 };
          break;
      }
  }
  let r = { isInt: i };
  return (Object.keys(t).length > 0 && (r.constraints = t), r);
}
function we(e) {
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
function be(e) {
  if (!e || typeof e != 'object') return null;
  if ('kind' in e) {
    let s = e;
    switch (s.kind) {
      case 'min': {
        let o = { kind: 'min', value: s.value };
        return (s.inclusive !== void 0 && (o.inclusive = s.inclusive), o);
      }
      case 'max': {
        let o = { kind: 'max', value: s.value };
        return (s.inclusive !== void 0 && (o.inclusive = s.inclusive), o);
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
    let s = e.format;
    if (s === 'int' || s === 'safeint') return { kind: 'int' };
  }
  if (n === 'greater_than') {
    let s = e.value,
      o = e.inclusive;
    if (s !== void 0) return { kind: 'min', value: s, inclusive: o ?? !1 };
  }
  if (n === 'less_than') {
    let s = e.value,
      o = e.inclusive;
    if (s !== void 0) return { kind: 'max', value: s, inclusive: o ?? !1 };
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
        let o = r.format;
        if (o === 'int' || o === 'safeint') return { kind: 'int' };
        break;
      }
    }
  return e.isInt === !0 ? { kind: 'int' } : null;
}
import { pathToFileURL as Je } from 'node:url';
import S from 'node:path';
import ne from 'node:fs/promises';
import E from 'typescript';
var x = class extends Error {
  constructor(n) {
    (super(n), (this.name = 'SchemaLoadError'));
  }
};
async function te(e) {
  let n = S.resolve(e.file);
  e.registerTsLoader && (await Ke());
  let { warnings: t, dependencies: i } = await He(n, {
      ...(e.tsconfigPath !== void 0 && { tsconfigPath: e.tsconfigPath }),
      ...(e.allowUnresolved !== void 0 && { allowUnresolved: e.allowUnresolved }),
    }),
    r;
  try {
    r = await import(Je(n).href);
  } catch (o) {
    let a = o instanceof Error ? o.message : String(o);
    throw new x(`Failed to import schema module "${n}": ${a}`);
  }
  if (!(e.exportName in r)) {
    let o = Object.keys(r).filter((a) => a !== 'default');
    throw new x(
      `Export "${e.exportName}" not found in "${n}". Available exports: ${o.join(', ') || '(none)'}`,
    );
  }
  let s = r[e.exportName];
  if (!Xe(s)) throw new x(`Export "${e.exportName}" in "${n}" is not a Zod schema.`);
  return { schema: s, warnings: t, dependencies: i };
}
var Z = null;
async function Ke() {
  if (Z) {
    await Z;
    return;
  }
  ((Z = import('tsx/esm').catch((e) => {
    Z = null;
    let n = e instanceof Error ? e.message : String(e);
    throw new x(
      `Failed to register TypeScript loader (tsx). Install "tsx" as a dependency or precompile schemas. ${n}`,
    );
  })),
    await Z);
}
function Xe(e) {
  return !e || typeof e != 'object' ? !1 : '_def' in e || '_zod' in e;
}
async function He(e, n) {
  let t = new Set(),
    i = [],
    r = [S.resolve(e)],
    s = n.tsconfigPath ? await Qe(n.tsconfigPath) : void 0;
  for (; r.length; ) {
    let o = r.pop();
    if (!o || t.has(o)) continue;
    t.add(o);
    let a;
    try {
      a = await ne.readFile(o, 'utf8');
    } catch {
      continue;
    }
    let u = S.dirname(o),
      c = E.createSourceFile(o, a, E.ScriptTarget.Latest, !0).statements.filter(
        E.isImportDeclaration,
      );
    for (let m of c) {
      if (!m.moduleSpecifier || !E.isStringLiteral(m.moduleSpecifier)) continue;
      let d = m.moduleSpecifier.text,
        p = await Ye(d, u, s);
      if (p !== null) {
        if (!p) {
          if (n.allowUnresolved) {
            i.push(`Unresolved import "${d}" from ${o}`);
            continue;
          }
          throw new x(`Failed to resolve import "${d}" from ${o}`);
        }
        r.push(p);
      }
    }
  }
  return { warnings: i, dependencies: Array.from(t) };
}
async function Qe(e) {
  try {
    let n = await ne.readFile(e, 'utf8'),
      t = E.parseConfigFileTextToJson(e, n);
    return t.error ? void 0 : E.parseJsonConfigFileContent(t.config, E.sys, S.dirname(e));
  } catch {
    return;
  }
}
async function Ye(e, n, t) {
  if (e.startsWith('.') || e.startsWith('/')) return await ke(S.resolve(n, e));
  if (t?.options.paths && t.options.baseUrl) {
    let i = en(e, t.options.baseUrl, t.options.paths);
    if (i) {
      let r = await ke(i);
      if (r) return r;
    }
  }
  return null;
}
function en(e, n, t) {
  for (let [i, r] of Object.entries(t)) {
    let s = i.indexOf('*');
    if (s === -1) {
      if (i === e && r.length > 0) {
        let u = r[0];
        if (u) return S.resolve(n, u);
      }
      continue;
    }
    let o = i.slice(0, s),
      a = i.slice(s + 1);
    if (e.startsWith(o) && e.endsWith(a) && r.length > 0) {
      let u = r[0];
      if (u) {
        let l = e.slice(o.length, e.length - a.length),
          c = u.replace('*', l);
        return S.resolve(n, c);
      }
    }
  }
  return null;
}
async function ke(e) {
  let n = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'],
    t = new Set();
  for (let r of n) t.add(e.endsWith(r) ? e : e + r);
  let i = S.parse(e);
  if (['.js', '.mjs', '.cjs'].includes(i.ext)) {
    let r = S.join(i.dir, i.name);
    for (let s of n) t.add(r + s);
  }
  for (let r of t)
    try {
      if ((await ne.stat(r)).isFile()) return r;
    } catch {
      continue;
    }
  return null;
}
import nn from 'node:fs/promises';
import q from 'node:path';
import { pathToFileURL as tn } from 'node:url';
async function re(e) {
  let {
      sourceDir: n,
      extensions: t = ['.ts', '.tsx', '.js', '.mjs'],
      ignore: i = ['node_modules', '.git', 'dist', 'build', 'coverage'],
      registerTsLoader: r = !0,
      tsconfigPath: s,
      allowUnresolved: o = !1,
      exportNamePattern: a,
    } = e,
    u = q.resolve(n),
    l = [],
    c = [],
    m = [];
  r && (await an());
  let d = a !== void 0 ? un(a) : void 0,
    p = await rn(u, t, i),
    b = new Set();
  for (let f of p)
    if (!b.has(f)) {
      b.add(f);
      try {
        let g = { registerTsLoader: !1, allowUnresolved: o };
        s !== void 0 && (g.tsconfigPath = s);
        let w = await sn(f, g),
          y = d !== void 0 ? w.filter((v) => d.test(v.exportName)) : w;
        if (y.length === 0) {
          m.push(f);
          continue;
        }
        l.push(...y);
      } catch (g) {
        let w = g instanceof Error ? g.message : String(g);
        if (o) {
          (c.push(`Failed to process ${f}: ${w}`), m.push(f));
          continue;
        }
        throw g instanceof Error ? g : new Error(w);
      }
    }
  return { schemas: l, warnings: c, skippedFiles: m };
}
async function rn(e, n, t) {
  let i = [],
    r = new Set(n);
  async function s(o) {
    let a = await nn.readdir(o, { withFileTypes: !0 });
    for (let u of a) {
      let l = q.join(o, u.name);
      if (!t.some((c) => u.name.includes(c))) {
        if (u.isDirectory()) await s(l);
        else if (u.isFile()) {
          let c = q.extname(u.name);
          r.has(c) && i.push(l);
        }
      }
    }
  }
  return (await s(e), i);
}
async function sn(e, n) {
  let t = q.resolve(e),
    i = await import(tn(t).href),
    r = [];
  for (let [s, o] of Object.entries(i))
    s !== 'default' && on(o) && r.push({ file: t, exportName: s, schema: o });
  return r;
}
function on(e) {
  return !e || typeof e != 'object' ? !1 : '_def' in e || '_zod' in e;
}
var O = null;
async function an() {
  if (O) {
    await O;
    return;
  }
  ((O = import('tsx/esm').catch((e) => {
    O = null;
    let n = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to register TypeScript loader (tsx). Install "tsx" as a dependency. ${n}`,
    );
  })),
    await O);
}
function un(e) {
  let n = e.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${n}$`);
}
import G from 'node:fs/promises';
import h from 'node:path';
async function ie(e) {
  let {
      outDir: n,
      target: t,
      preserveStructure: i = !0,
      skipEmptyFiles: r = !0,
      generateInitFiles: s = !1,
      ...o
    } = e,
    a = h.resolve(n);
  await G.mkdir(a, { recursive: !0 });
  let u = await re(o),
    l = [...u.warnings],
    c = [...u.skippedFiles],
    m = [],
    d = s && (t === 'pydantic' || t === 'all') ? new Map() : null,
    p = new Map(),
    b = new Map();
  for (let y of u.schemas) {
    let v = y.exportName;
    if (!p.has(v)) (p.set(v, y), b.set(v, y.file));
    else {
      let N = b.get(v);
      if (!N) {
        (p.set(v, y), b.set(v, y.file));
        continue;
      }
      if (h.basename(y.file) === 'index.ts' || h.basename(y.file) === 'index.js') continue;
      (h.basename(N) === 'index.ts' || h.basename(N) === 'index.js') &&
        (p.set(v, y), b.set(v, y.file));
    }
  }
  let f = new Map();
  for (let y of p.values()) {
    let v = f.get(y.file) || [];
    (v.push(y), f.set(y.file, v));
  }
  let g = new Map(),
    w = new Set();
  for (let [y, v] of f.entries()) {
    if (v.length === 0) continue;
    let N = h.relative(o.sourceDir, y),
      _;
    if (i) {
      let F = h.dirname(N),
        J = h.basename(y, h.extname(y));
      _ = h.join(a, F, J);
    } else _ = a;
    for (let F of v) {
      let J = t === 'all' ? ['pydantic', 'typescript'] : [t];
      for (let K of J)
        try {
          let T = {
            preserveStructure: i,
            outputBasePath: _,
            sourceFile: y,
            outDir: a,
            usedNames: g,
          };
          (e.enumStyle !== void 0 && (T.enumStyle = e.enumStyle),
            e.enumBaseType !== void 0 && (T.enumBaseType = e.enumBaseType));
          let j = ln(F, K, T),
            A = j.path,
            X = h.dirname(A);
          (w.has(X) || (await G.mkdir(X, { recursive: !0 }), w.add(X)),
            await G.writeFile(A, j.content, 'utf8'),
            d && K === 'pydantic' && cn(d, A, j.symbolName),
            m.push({ path: A, sourceFile: y, exportName: F.exportName, target: K }));
        } catch (T) {
          let j = T instanceof Error ? T.message : String(T);
          l.push(`Failed to convert ${F.exportName} from ${y}: ${j}`);
        }
    }
  }
  return (d && (await dn(a, d)), { files: m, warnings: l, skippedFiles: c });
}
function ln(e, n, t) {
  let { schema: i, exportName: r } = e,
    {
      preserveStructure: s,
      outputBasePath: o,
      outDir: a,
      usedNames: u,
      enumStyle: l,
      enumBaseType: c,
    } = t,
    m = fn(r),
    d = gn(r),
    p = n === 'pydantic' ? '.py' : '.d.ts',
    b = s ? h.dirname(o) : a,
    f = `${d}${p}`,
    g = h.join(b, f),
    w = u.get(g) ?? 0;
  (w > 0 && ((f = `${d}_${w}${p}`), (g = h.join(b, f))), u.set(g, w + 1));
  let y;
  s ? (y = h.join(h.dirname(o), f)) : (y = h.join(a, f));
  let v = { name: m, sourceModule: e.file };
  (l !== void 0 && (v.enumStyle = l), c !== void 0 && (v.enumBaseType = c));
  let N = n === 'pydantic' ? se(i, v) : oe(i, v);
  return { path: y, content: N, symbolName: m };
}
function cn(e, n, t) {
  let i = h.dirname(n),
    r = h.basename(n, h.extname(n)),
    s = e.get(i) ?? [];
  (s.push({ moduleName: r, symbolNames: [t] }), e.set(i, s));
}
async function dn(e, n) {
  let t = pn(e, n);
  t.has(e) || t.add(e);
  let r = mn(e, t, n).get(e);
  if (!r) return;
  let s = new Map(),
    o = (a) => {
      let u = [],
        l = [],
        c = [...a.modules].sort((f, g) => f.moduleName.localeCompare(g.moduleName));
      for (let f of c) {
        let g = f.symbolNames.join(', ');
        (u.push(`from .${f.moduleName} import ${g}`), l.push(...f.symbolNames));
      }
      let m = [...a.children].sort((f, g) => h.basename(f.path).localeCompare(h.basename(g.path)));
      for (let f of m) {
        let g = o(f);
        if (g.length === 0) continue;
        let w = h.basename(f.path);
        (u.push(`from .${w} import ${g.join(', ')}`), l.push(...g));
      }
      let d = [],
        p = new Set();
      for (let f of l) p.has(f) || (p.add(f), d.push(f));
      let b = '';
      if (
        (u.length > 0 &&
          (b += `${u.join(`
`)}

`),
        d.length > 0)
      ) {
        let f = d.map((g) => `"${g}"`).join(', ');
        b += `__all__ = [${f}]
`;
      }
      return (s.set(a.path, b), d);
    };
  o(r);
  for (let [a, u] of s.entries()) {
    let l = h.join(a, '__init__.py');
    await G.writeFile(l, u, 'utf8');
  }
}
function pn(e, n) {
  let t = new Set();
  for (let i of n.keys()) {
    t.add(i);
    let r = i;
    for (;;) {
      let s = xe(r, e);
      if (!s) break;
      if (t.has(s)) {
        r = s;
        continue;
      }
      (t.add(s), (r = s));
    }
  }
  return t;
}
function mn(e, n, t) {
  let i = new Map(),
    r = (s) => {
      let o = i.get(s);
      return (
        o || ((o = { path: s, modules: t.get(s) ?? [], children: new Set() }), i.set(s, o)),
        o
      );
    };
  for (let s of n) r(s);
  for (let s of n) {
    let o = xe(s, e);
    if (!o) continue;
    let a = r(o),
      u = r(s);
    a !== u && a.children.add(u);
  }
  return i;
}
function xe(e, n) {
  if (e === n) return null;
  let t = h.dirname(e);
  return !t || t === e || !t.startsWith(n) ? null : t;
}
function fn(e) {
  return (
    e
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
      .join('') || 'Model'
  );
}
function gn(e) {
  return e
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}
function se(e, n) {
  let { node: t, warnings: i } = ee(e),
    r = { name: n.name, warnings: i };
  return (
    n.sourceModule !== void 0 && (r.sourceModule = n.sourceModule),
    n.enumStyle !== void 0 && (r.enumStyle = n.enumStyle),
    n.enumBaseType !== void 0 && (r.enumBaseType = n.enumBaseType),
    t.type === 'enum' ? de(t, r) : t.type === 'object' ? ce(t, r) : pe(t, r)
  );
}
function oe(e, n) {
  let { node: t, warnings: i } = ee(e),
    r = { name: n.name, warnings: i };
  return (
    n.sourceModule !== void 0 && (r.sourceModule = n.sourceModule),
    n.exportNameOverrides !== void 0 && (r.exportNameOverrides = n.exportNameOverrides),
    t.type === 'enum' ? Q(t, r) : t.type === 'object' ? he(t, r) : ve(t, r)
  );
}
function Ne(e) {
  let { schema: n, target: t, out: i, ...r } = e,
    s = [],
    o = r.name,
    a = i ? $.resolve(i) : void 0,
    u = (c) => (c === 'pydantic' ? '.py' : '.d.ts');
  if (t === 'all') {
    if (a && $.extname(a))
      return Promise.reject(
        new Error(
          'When target is "all", --out must be a directory or omitted. Received a file path with extension.',
        ),
      );
    let c = a ?? process.cwd();
    s.push(
      { target: 'pydantic', path: $.join(c, `${o}${u('pydantic')}`) },
      { target: 'typescript', path: $.join(c, `${o}${u('typescript')}`) },
    );
  } else
    a
      ? $.extname(a)
        ? s.push({ target: t, path: a })
        : s.push({ target: t, path: `${a}${u(t)}` })
      : s.push({ target: t, path: $.join(process.cwd(), `${o}${u(t)}`) });
  let l = s.map(async (c) => {
    let m = c.target === 'pydantic' ? se(n, r) : oe(n, r);
    return (
      await Se.mkdir($.dirname(c.path), { recursive: !0 }),
      await Se.writeFile(c.path, m, 'utf8'),
      { path: c.path, target: c.target }
    );
  });
  return Promise.all(l);
}
var Te = `
Usage:
  schemabridge convert zod <input-file> --export <schema-name> [--to pydantic|typescript|all] [--out <path>] [--allow-unresolved] [--enum-style enum|literal] [--enum-base-type str|int]
  schemabridge convert folder <source-dir> --out <output-dir> [--to pydantic|typescript|all] [--flat] [--init] [--export-pattern <pattern>] [--allow-unresolved] [--enum-style enum|literal] [--enum-base-type str|int]

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

  # Only convert exports whose names match a pattern (e.g. *Schema)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --export-pattern '*Schema'
`.trim();
async function hn(e = ae.argv.slice(2)) {
  try {
    let n = vn(e);
    if (n.mode === 'folder') {
      let o = await ie({
        sourceDir: n.sourceDir,
        outDir: n.out,
        target: n.target,
        preserveStructure: !n.flat,
        generateInitFiles: n.generateInitFiles,
        registerTsLoader: !0,
        allowUnresolved: n.allowUnresolved,
        ...(n.exportNamePattern !== void 0 && { exportNamePattern: n.exportNamePattern }),
        ...(n.tsconfigPath !== void 0 && { tsconfigPath: n.tsconfigPath }),
        ...(n.enumStyle !== void 0 && { enumStyle: n.enumStyle }),
        ...(n.enumBaseType !== void 0 && { enumBaseType: n.enumBaseType }),
      });
      for (let a of o.warnings) console.warn(`Warning: ${a}`);
      o.skippedFiles.length > 0 &&
        console.warn(`Skipped ${o.skippedFiles.length} files (no schemas found)`);
      for (let a of o.files) console.log(`Wrote ${a.target}: ${a.path}`);
      return (
        console.log(`
Converted ${o.files.length} schema(s) successfully.`),
        0
      );
    }
    let { schema: t, warnings: i } = await te({
      file: n.inputFile,
      exportName: n.exportName,
      registerTsLoader: !0,
      ...(n.tsconfigPath !== void 0 && { tsconfigPath: n.tsconfigPath }),
      allowUnresolved: n.allowUnresolved,
    });
    for (let o of i) console.warn(`Warning: ${o}`);
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
    let s = await Ne(r);
    for (let o of s) console.log(`Wrote ${o.target}: ${o.path}`);
    return 0;
  } catch (n) {
    let t = n instanceof x || n instanceof Error ? n.message : String(n);
    return (console.error(`Error: ${t}`), console.error(Te), 1);
  }
}
function vn(e) {
  if (e.length === 0 || e.includes('--help') || e.includes('-h')) throw new Error(Te);
  let [n, t, ...i] = e;
  if (n !== 'convert') throw new Error('Expected command: convert zod|folder ...');
  if (t === 'folder') return bn(i);
  if (t !== 'zod')
    throw new Error('Expected command: convert zod <input-file> or convert folder <source-dir>');
  return wn(i);
}
function wn(e) {
  if (e.length === 0) throw new Error('Missing <input-file>');
  let n = e[0];
  if (!n) throw new Error('Missing <input-file>');
  let t,
    i = 'pydantic',
    r,
    s = !1,
    o,
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
          s = !0;
          break;
        case '--tsconfig': {
          let d = e[++c];
          if (!d || d.startsWith('-'))
            throw new Error('--tsconfig requires a value: --tsconfig <path>');
          o = d;
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
    inputFile: I.resolve(n),
    exportName: t,
    target: i,
    allowUnresolved: s,
    ...(o !== void 0 && { tsconfigPath: o }),
    ...(a !== void 0 && { enumStyle: a }),
    ...(u !== void 0 && { enumBaseType: u }),
  };
  return (r !== void 0 && (l.out = r), l);
}
function bn(e) {
  if (e.length === 0) throw new Error('Missing <source-dir>');
  let n = e[0];
  if (!n) throw new Error('Missing <source-dir>');
  let t = 'pydantic',
    i,
    r = !1,
    s = !1,
    o = !1,
    a,
    u,
    l,
    c;
  for (let m = 1; m < e.length; m++) {
    let d = e[m];
    if (d)
      switch (d) {
        case '--to': {
          let p = e[++m];
          if (!p || p.startsWith('-'))
            throw new Error('--to requires a value: --to pydantic|typescript|all');
          if (p !== 'pydantic' && p !== 'typescript' && p !== 'all')
            throw new Error('Invalid --to value. Expected "pydantic", "typescript", or "all".');
          t = p;
          break;
        }
        case '--out': {
          let p = e[++m];
          if (!p || p.startsWith('-'))
            throw new Error('--out requires a value: --out <output-dir>');
          i = p;
          break;
        }
        case '--allow-unresolved':
          r = !0;
          break;
        case '--flat':
          s = !0;
          break;
        case '--init':
          o = !0;
          break;
        case '--export-pattern': {
          let p = e[++m];
          if (!p || p.startsWith('-'))
            throw new Error("--export-pattern requires a value, e.g. --export-pattern '*Schema'");
          a = p;
          break;
        }
        case '--tsconfig': {
          let p = e[++m];
          if (!p || p.startsWith('-'))
            throw new Error('--tsconfig requires a value: --tsconfig <path>');
          u = p;
          break;
        }
        case '--enum-style': {
          let p = e[++m];
          if (!p || p.startsWith('-'))
            throw new Error('--enum-style requires a value: --enum-style enum|literal');
          if (p !== 'enum' && p !== 'literal')
            throw new Error('Invalid --enum-style value. Expected "enum" or "literal".');
          l = p;
          break;
        }
        case '--enum-base-type': {
          let p = e[++m];
          if (!p || p.startsWith('-'))
            throw new Error('--enum-base-type requires a value: --enum-base-type str|int');
          if (p !== 'str' && p !== 'int')
            throw new Error('Invalid --enum-base-type value. Expected "str" or "int".');
          c = p;
          break;
        }
        default:
          throw d.startsWith('-')
            ? new Error(`Unknown option: ${d}`)
            : new Error(`Unexpected argument: ${d}`);
      }
  }
  if (!i) throw new Error('Missing required --out <output-dir>');
  return {
    mode: 'folder',
    sourceDir: I.resolve(n),
    out: I.resolve(i),
    target: t,
    allowUnresolved: r,
    flat: s,
    generateInitFiles: o,
    ...(a !== void 0 && { exportNamePattern: a }),
    ...(u !== void 0 && { tsconfigPath: u }),
    ...(l !== void 0 && { enumStyle: l }),
    ...(c !== void 0 && { enumBaseType: c }),
  };
}
I.resolve(yn(import.meta.url)) === I.resolve(ae.argv[1] ?? '') &&
  hn().then((e) => {
    e !== 0 && ae.exit(e);
  });
export { hn as runCLI };
