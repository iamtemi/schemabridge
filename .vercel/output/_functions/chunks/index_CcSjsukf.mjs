import { D as createVNode, F as Fragment, aN as __astro_tag_component__ } from './astro/server_m2Kd7PvH.mjs';
import { g as $$CardGrid, i as $$Card } from './Code_BUBlebyv.mjs';

const frontmatter = {
  "title": "SchemaBridge",
  "description": "Keep your TypeScript Zod schemas and Python models in sync.",
  "template": "splash",
  "hero": {
    "tagline": "One source of truth for your schemas.",
    "image": {
      "file": "../../assets/hand.webp"
    },
    "actions": [{
      "text": "Read the docs",
      "link": "/getting-started",
      "icon": "open-book"
    }, {
      "text": "Try the playground",
      "link": "/playground",
      "icon": "right-arrow",
      "variant": "primary"
    }]
  }
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "what-is-schemabridge",
    "text": "What is SchemaBridge?"
  }, {
    "depth": 2,
    "slug": "tiny-example",
    "text": "Tiny example"
  }, {
    "depth": 2,
    "slug": "how-you-use-it",
    "text": "How you use it"
  }, {
    "depth": 2,
    "slug": "where-to-go-next",
    "text": "Where to go next"
  }];
}
function _createMdxContent(props) {
  const {Fragment: Fragment$1} = props.components || ({});
  if (!Fragment$1) _missingMdxReference("Fragment");
  return createVNode(Fragment, {
    children: [createVNode(Fragment$1, {
      "set:html": "<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"what-is-schemabridge\">What is SchemaBridge?</h2><a class=\"sl-anchor-link\" href=\"#what-is-schemabridge\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “What is SchemaBridge?”</span></a></div>\n<p>SchemaBridge is a <strong>cross‑language schema generator</strong>.\nYou define your data models once with <a href=\"https://zod.dev/\">Zod</a> in TypeScript, and SchemaBridge generates:</p>\n<ul>\n<li><strong>Python Pydantic models</strong> for your backend.</li>\n<li><strong>TypeScript <code dir=\"auto\">.d.ts</code> types</strong> to keep the rest of your TS code in sync.</li>\n</ul>\n<p>That means a single source of truth for validation, types, and runtime models—no more hand‑maintained copies.</p>\n<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"tiny-example\">Tiny example</h2><a class=\"sl-anchor-link\" href=\"#tiny-example\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Tiny example”</span></a></div>\n"
    }), createVNode($$CardGrid, {
      children: [createVNode($$Card, {
        title: "Input (TypeScript, Zod)",
        icon: "seti:typescript",
        "set:html": "<div class=\"expressive-code\"><link rel=\"stylesheet\" href=\"/_astro/ec.6oty3.css\"><script type=\"module\" src=\"/_astro/ec.p1z7b.js\"></script><figure class=\"frame not-content\"><figcaption class=\"header\"></figcaption><pre data-language=\"ts\"><code><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#55987B;--1:#1E754F\">import</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#8B8B8B;--1:#686868\">{</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#BD976A;--1:#876037\">z</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#8B8B8B;--1:#686868\">}</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#55987B;--1:#1E754F\">from</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7DE4;--1:#96574AFD\">'</span><span style=\"--0:#C98A7D;--1:#96574A\">zod</span><span style=\"--0:#C98A7DE4;--1:#96574AFD\">'</span><span style=\"--0:#8B8B8B;--1:#686868\">;</span></div></div><div class=\"ec-line\"><div class=\"code\">\n</div></div><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#55987B;--1:#1E754F\">export</span><span style=\"--0:#CB7676;--1:#9E5252\"> const </span><span style=\"--0:#BD976A;--1:#876037\">userSchema</span><span style=\"--0:#CB7676;--1:#9E5252\"> </span><span style=\"--0:#8B8B8B;--1:#686868\">=</span><span style=\"--0:#CB7676;--1:#9E5252\"> </span><span style=\"--0:#BD976A;--1:#876037\">z</span><span style=\"--0:#8B8B8B;--1:#686868\">.</span><span style=\"--0:#80A665;--1:#4B7231\">object</span><span style=\"--0:#8B8B8B;--1:#686868\">({</span></div></div><div class=\"ec-line\"><div class=\"code\"><span class=\"indent\">  </span><span style=\"--0:#B8A965;--1:#786713\">id</span><span style=\"--0:#8B8B8B;--1:#686868\">: </span><span style=\"--0:#BD976A;--1:#876037\">z</span><span style=\"--0:#8B8B8B;--1:#686868\">.</span><span style=\"--0:#80A665;--1:#4B7231\">string</span><span style=\"--0:#8B8B8B;--1:#686868\">().</span><span style=\"--0:#80A665;--1:#4B7231\">uuid</span><span style=\"--0:#8B8B8B;--1:#686868\">(),</span></div></div><div class=\"ec-line\"><div class=\"code\"><span class=\"indent\">  </span><span style=\"--0:#B8A965;--1:#786713\">email</span><span style=\"--0:#8B8B8B;--1:#686868\">: </span><span style=\"--0:#BD976A;--1:#876037\">z</span><span style=\"--0:#8B8B8B;--1:#686868\">.</span><span style=\"--0:#80A665;--1:#4B7231\">string</span><span style=\"--0:#8B8B8B;--1:#686868\">().</span><span style=\"--0:#80A665;--1:#4B7231\">email</span><span style=\"--0:#8B8B8B;--1:#686868\">(),</span></div></div><div class=\"ec-line\"><div class=\"code\"><span class=\"indent\">  </span><span style=\"--0:#B8A965;--1:#786713\">createdAt</span><span style=\"--0:#8B8B8B;--1:#686868\">: </span><span style=\"--0:#BD976A;--1:#876037\">z</span><span style=\"--0:#8B8B8B;--1:#686868\">.</span><span style=\"--0:#80A665;--1:#4B7231\">date</span><span style=\"--0:#8B8B8B;--1:#686868\">(),</span></div></div><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#8B8B8B;--1:#686868\">});</span></div></div></code></pre><div class=\"copy\"><button title=\"Copy to clipboard\" data-copied=\"Copied!\" data-code=\"import { z } from &#x27;zod&#x27;;export const userSchema = z.object({  id: z.string().uuid(),  email: z.string().email(),  createdAt: z.date(),});\"><div></div></button></div></figure></div>"
      }), createVNode($$Card, {
        title: "Output (Python, Pydantic)",
        icon: "seti:python",
        "set:html": "<div class=\"expressive-code\"><figure class=\"frame not-content\"><figcaption class=\"header\"></figcaption><pre data-language=\"python\"><code><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#55987B;--1:#1E754F\">from</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> pydantic </span><span style=\"--0:#55987B;--1:#1E754F\">import</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> BaseModel</span></div></div><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#55987B;--1:#1E754F\">from</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> uuid </span><span style=\"--0:#55987B;--1:#1E754F\">import</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">UUID</span></div></div><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#55987B;--1:#1E754F\">from</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> datetime </span><span style=\"--0:#55987B;--1:#1E754F\">import</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> datetime</span></div></div><div class=\"ec-line\"><div class=\"code\">\n</div></div><div class=\"ec-line\"><div class=\"code\">\n</div></div><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#CB7676;--1:#9E5252\">class</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#5DA994;--1:#25746A\">UserSchema</span><span style=\"--0:#8B8B8B;--1:#686868\">(</span><span style=\"--0:#80A665;--1:#4B7231\">BaseModel</span><span style=\"--0:#8B8B8B;--1:#686868\">):</span></div></div><div class=\"ec-line\"><div class=\"code\"><span class=\"indent\">    </span><span style=\"--0:#B8A965;--1:#786713\">id</span><span style=\"--0:#8B8B8B;--1:#686868\">:</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">UUID</span></div></div><div class=\"ec-line\"><div class=\"code\"><span class=\"indent\"><span style=\"--0:#DBD7CAEE;--1:#393A34\">    </span></span><span style=\"--0:#DBD7CAEE;--1:#393A34\">email</span><span style=\"--0:#8B8B8B;--1:#686868\">:</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#B8A965;--1:#786713\">str</span></div></div><div class=\"ec-line\"><div class=\"code\"><span class=\"indent\"><span style=\"--0:#DBD7CAEE;--1:#393A34\">    </span></span><span style=\"--0:#DBD7CAEE;--1:#393A34\">createdAt</span><span style=\"--0:#8B8B8B;--1:#686868\">:</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> datetime</span></div></div></code></pre><div class=\"copy\"><button title=\"Copy to clipboard\" data-copied=\"Copied!\" data-code=\"from pydantic import BaseModelfrom uuid import UUIDfrom datetime import datetimeclass UserSchema(BaseModel):    id: UUID    email: str    createdAt: datetime\"><div></div></button></div></figure></div>"
      })]
    }), "\n", createVNode(Fragment$1, {
      "set:html": "<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"how-you-use-it\">How you use it</h2><a class=\"sl-anchor-link\" href=\"#how-you-use-it\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “How you use it”</span></a></div>\n<ul>\n<li><strong>CLI</strong> – convert a single schema or an entire folder:</li>\n</ul>\n<div class=\"expressive-code\"><figure class=\"frame is-terminal not-content\"><figcaption class=\"header\"><span class=\"title\"></span><span class=\"sr-only\">Terminal window</span></figcaption><pre data-language=\"bash\"><code><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#80A665;--1:#4B7231\">schemabridge</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">convert</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">zod</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">schema.ts</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">--export</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">userSchema</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">--to</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">pydantic</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">--out</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">user.py</span></div></div><div class=\"ec-line\"><div class=\"code\">\n</div></div><div class=\"ec-line\"><div class=\"code\"><span style=\"--0:#80A665;--1:#4B7231\">schemabridge</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">convert</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">folder</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">./src/schemas</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">--out</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">./generated</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">--to</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C98A7D;--1:#96574A\">pydantic</span><span style=\"--0:#DBD7CAEE;--1:#393A34\"> </span><span style=\"--0:#C99076;--1:#995728\">--init</span></div></div></code></pre><div class=\"copy\"><button title=\"Copy to clipboard\" data-copied=\"Copied!\" data-code=\"schemabridge convert zod schema.ts --export userSchema --to pydantic --out user.pyschemabridge convert folder ./src/schemas --out ./generated --to pydantic --init\"><div></div></button></div></figure></div>\n<ul>\n<li><strong>Node API</strong> – call SchemaBridge from build scripts and tooling.</li>\n<li><strong>Playground</strong> – paste a schema and see the generated code side‑by‑side.</li>\n</ul>\n<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"where-to-go-next\">Where to go next</h2><a class=\"sl-anchor-link\" href=\"#where-to-go-next\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Where to go next”</span></a></div>\n<ul>\n<li>Start with <strong><a href=\"/getting-started\">Getting Started</a></strong> to install and run your first conversion.</li>\n<li>Browse the <strong><a href=\"/api\">API Reference</a></strong> if you want to embed SchemaBridge in your own tools.</li>\n<li>Open the <strong><a href=\"/playground\">Playground</a></strong> to experiment with schemas and see the output live.</li>\n</ul>"
    })]
  });
}
function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? createVNode(MDXLayout, {
    ...props,
    children: createVNode(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + ("component" ) + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}

const url = "src/content/docs/index.mdx";
const file = "/Users/temi/codebase/schemabridge/packages/docs/src/content/docs/index.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Users/temi/codebase/schemabridge/packages/docs/src/content/docs/index.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
