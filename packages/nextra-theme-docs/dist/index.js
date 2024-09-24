var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.tsx
import { useRouter as useRouter8 } from "next/router";
import { useMemo as useMemo5 } from "react";
import "focus-visible";
import cn17 from "clsx";
import { useFSRoute as useFSRoute3, useMounted as useMounted8 } from "nextra/hooks";
import { MDXProvider } from "nextra/mdx";

// src/constants.tsx
import { useRouter as useRouter7 } from "next/router";
import { DiscordIcon, GitHubIcon } from "nextra/icons";
import { isValidElement } from "react";
import { z as z2 } from "zod";

// src/components/anchor.tsx
import NextLink from "next/link";
import next from "next/package.json";
import { forwardRef } from "react";

// src/contexts/active-anchor.tsx
import "intersection-observer";
import { createContext, useContext, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
var ActiveAnchorContext = createContext({});
var SetActiveAnchorContext = createContext((v) => v);
var IntersectionObserverContext = createContext(
  null
);
var slugs = /* @__PURE__ */ new WeakMap();
var SlugsContext = createContext(slugs);
var useActiveAnchor = () => useContext(ActiveAnchorContext);
var useSetActiveAnchor = () => useContext(SetActiveAnchorContext);
var useIntersectionObserver = () => useContext(IntersectionObserverContext);
var useSlugs = () => useContext(SlugsContext);
var ActiveAnchorProvider = ({
  children
}) => {
  const [activeAnchor, setActiveAnchor] = useState({});
  const observerRef = useRef(null);
  if (IS_BROWSER && !observerRef.current) {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setActiveAnchor((f) => {
          const ret = __spreadValues({}, f);
          for (const entry of entries) {
            if ((entry == null ? void 0 : entry.rootBounds) && slugs.has(entry.target)) {
              const [slug, index] = slugs.get(entry.target);
              const aboveHalfViewport = entry.boundingClientRect.y + entry.boundingClientRect.height <= entry.rootBounds.y + entry.rootBounds.height;
              const insideHalfViewport = entry.intersectionRatio > 0;
              ret[slug] = {
                index,
                aboveHalfViewport,
                insideHalfViewport
              };
            }
          }
          let activeSlug = "";
          let smallestIndexInViewport = Infinity;
          let largestIndexAboveViewport = -1;
          for (const s in ret) {
            ret[s].isActive = false;
            if (ret[s].insideHalfViewport && ret[s].index < smallestIndexInViewport) {
              smallestIndexInViewport = ret[s].index;
              activeSlug = s;
            }
            if (smallestIndexInViewport === Infinity && ret[s].aboveHalfViewport && ret[s].index > largestIndexAboveViewport) {
              largestIndexAboveViewport = ret[s].index;
              activeSlug = s;
            }
          }
          if (ret[activeSlug]) ret[activeSlug].isActive = true;
          return ret;
        });
      },
      {
        rootMargin: "0px 0px -50%",
        threshold: [0, 1]
      }
    );
  }
  return /* @__PURE__ */ jsx(ActiveAnchorContext.Provider, { value: activeAnchor, children: /* @__PURE__ */ jsx(SetActiveAnchorContext.Provider, { value: setActiveAnchor, children: /* @__PURE__ */ jsx(SlugsContext.Provider, { value: slugs, children: /* @__PURE__ */ jsx(IntersectionObserverContext.Provider, { value: observerRef.current, children }) }) }) });
};

// src/contexts/config.tsx
import { ThemeProvider } from "next-themes";
import { metaSchema } from "nextra/normalize-pages";
import { createContext as createContext3, useContext as useContext3, useState as useState2 } from "react";

// src/contexts/menu.ts
import { createContext as createContext2, useContext as useContext2 } from "react";
var MenuContext = createContext2({
  menu: false,
  setMenu: () => false
});
var useMenu = () => useContext2(MenuContext);
var MenuProvider = MenuContext.Provider;

// src/contexts/config.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var ConfigContext = createContext3(__spreadValues({
  title: "",
  frontMatter: {}
}, DEFAULT_THEME));
function useConfig() {
  return useContext3(ConfigContext);
}
var theme;
var isValidated = false;
function normalizeZodMessage(error) {
  return error.issues.flatMap((issue) => {
    const themePath = issue.path.length > 0 && `Path: "${issue.path.join(".")}"`;
    const unionErrors = "unionErrors" in issue ? issue.unionErrors.map(normalizeZodMessage) : [];
    return [
      [issue.message, themePath].filter(Boolean).join(". "),
      ...unionErrors
    ];
  }).join("\n");
}
function validateMeta(pageMap) {
  for (const pageMapItem of pageMap) {
    if (pageMapItem.kind === "Meta") {
      for (const [key, data] of Object.entries(pageMapItem.data)) {
        try {
          metaSchema.parse(data);
        } catch (error) {
          console.error(
            `[nextra-theme-docs] Error validating _meta.json file for "${key}" property.

${normalizeZodMessage(
              error
            )}`
          );
        }
      }
    } else if (pageMapItem.kind === "Folder") {
      validateMeta(pageMapItem.children);
    }
  }
}
var ConfigProvider = ({
  children,
  value: { themeConfig, pageOpts }
}) => {
  const [menu, setMenu] = useState2(false);
  theme || (theme = __spreadValues(__spreadValues({}, DEFAULT_THEME), Object.fromEntries(
    Object.entries(themeConfig).map(([key, value]) => [
      key,
      value && typeof value === "object" && DEEP_OBJECT_KEYS.includes(key) ? (
        // @ts-expect-error -- key has always object value
        __spreadValues(__spreadValues({}, DEFAULT_THEME[key]), value)
      ) : value
    ])
  )));
  if (process.env.NODE_ENV !== "production" && !isValidated) {
    try {
      themeSchema.parse(theme);
    } catch (error) {
      console.error(
        `[nextra-theme-docs] Error validating theme config file.

${normalizeZodMessage(
          error
        )}`
      );
    }
    validateMeta(pageOpts.pageMap);
    isValidated = true;
  }
  const extendedConfig = __spreadProps(__spreadValues(__spreadProps(__spreadValues({}, theme), {
    flexsearch: pageOpts.flexsearch
  }), typeof pageOpts.newNextLinkBehavior === "boolean" && {
    newNextLinkBehavior: pageOpts.newNextLinkBehavior
  }), {
    title: pageOpts.title,
    frontMatter: pageOpts.frontMatter
  });
  const { nextThemes } = extendedConfig;
  return /* @__PURE__ */ jsx2(
    ThemeProvider,
    {
      attribute: "class",
      disableTransitionOnChange: true,
      defaultTheme: nextThemes.defaultTheme,
      storageKey: nextThemes.storageKey,
      forcedTheme: nextThemes.forcedTheme,
      children: /* @__PURE__ */ jsx2(ConfigContext.Provider, { value: extendedConfig, children: /* @__PURE__ */ jsx2(MenuProvider, { value: { menu, setMenu }, children }) })
    }
  );
};

// src/contexts/details.ts
import { createContext as createContext4, useContext as useContext4 } from "react";
var DetailsContext = createContext4((v) => v);
var useDetails = () => useContext4(DetailsContext);
var DetailsProvider = DetailsContext.Provider;

// src/components/anchor.tsx
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
var nextVersion = Number(next.version.split(".")[0]);
var Anchor = forwardRef(function(_a, forwardedRef) {
  var _b = _a, { href = "", children, newWindow } = _b, props = __objRest(_b, ["href", "children", "newWindow"]);
  const config = useConfig();
  if (newWindow) {
    return /* @__PURE__ */ jsxs(
      "a",
      __spreadProps(__spreadValues({
        ref: forwardedRef,
        href,
        target: "_blank",
        rel: "noreferrer"
      }, props), {
        style: { textDecoration: "none" },
        children: [
          children,
          /* @__PURE__ */ jsx3("span", { className: "nx-sr-only nx-select-none", children: " (opens in a new tab)" })
        ]
      })
    );
  }
  if (!href) {
    return /* @__PURE__ */ jsx3("a", __spreadProps(__spreadValues({ ref: forwardedRef }, props), { style: { textDecoration: "none" }, children }));
  }
  if (nextVersion > 12 || config.newNextLinkBehavior) {
    return /* @__PURE__ */ jsx3(NextLink, __spreadProps(__spreadValues({ ref: forwardedRef, href }, props), { style: { textDecoration: "none" }, passHref: true, children }));
  }
  return /* @__PURE__ */ jsx3(NextLink, { href, passHref: true, children: /* @__PURE__ */ jsx3("a", __spreadProps(__spreadValues({ ref: forwardedRef }, props), { style: { textDecoration: "none" }, children })) });
});
Anchor.displayName = "Anchor";

// src/components/banner.tsx
import cn from "clsx";
import { XIcon } from "nextra/icons";

// src/utils/get-git-issue-url.ts
import gitUrlParse from "git-url-parse";
var getGitIssueUrl = ({
  repository = "",
  title,
  labels
}) => {
  const repo = gitUrlParse(repository);
  if (!repo) throw new Error("Invalid `docsRepositoryBase` URL!");
  if (repo.resource.includes("gitlab")) {
    return `${repo.protocol}://${repo.resource}/${repo.owner}/${repo.name}/-/issues/new?issue[title]=${encodeURIComponent(title)}${labels ? `&issue[description]=/label${encodeURIComponent(` ~${labels}
`)}` : ""}`;
  }
  if (repo.resource.includes("github")) {
    return `${repo.protocol}://${repo.resource}/${repo.owner}/${repo.name}/issues/new?title=${encodeURIComponent(title)}&labels=${labels || ""}`;
  }
  return "#";
};

// src/utils/render.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
function renderComponent(ComponentOrNode, props) {
  if (!ComponentOrNode) return null;
  if (typeof ComponentOrNode !== "function") return ComponentOrNode;
  return /* @__PURE__ */ jsx4(ComponentOrNode, __spreadValues({}, props));
}
function renderString(stringOrFunction, props = {}) {
  const result = typeof stringOrFunction === "function" ? stringOrFunction(props) : stringOrFunction;
  return result || "";
}

// src/utils/use-popper.ts
import { createPopper } from "@popperjs/core";
import { useCallback, useMemo, useRef as useRef2 } from "react";
function usePopper(options) {
  const reference = useRef2(null);
  const popper = useRef2(null);
  const cleanupCallback = useRef2();
  const instantiatePopper = useCallback(() => {
    var _a;
    if (!reference.current || !popper.current) return;
    (_a = cleanupCallback.current) == null ? void 0 : _a.call(cleanupCallback);
    cleanupCallback.current = createPopper(
      reference.current,
      popper.current,
      options
    ).destroy;
  }, [reference, popper, cleanupCallback, options]);
  return useMemo(
    () => [
      (referenceDomNode) => {
        reference.current = referenceDomNode;
        instantiatePopper();
      },
      (popperDomNode) => {
        popper.current = popperDomNode;
        instantiatePopper();
      }
    ],
    [reference, popper, instantiatePopper]
  );
}

// src/utils/use-git-edit-url.ts
import gitUrlParse2 from "git-url-parse";
function useGitEditUrl(filePath = "") {
  const config = useConfig();
  const repo = gitUrlParse2(config.docsRepositoryBase || "");
  if (!repo) throw new Error("Invalid `docsRepositoryBase` URL!");
  return `${repo.href}/${filePath}`;
}

// src/components/banner.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs2 } from "react/jsx-runtime";
function Banner() {
  const { banner } = useConfig();
  if (!banner.text) {
    return null;
  }
  const hideBannerScript = `try{if(localStorage.getItem(${JSON.stringify(
    banner.key
  )})==='0'){document.body.classList.add('nextra-banner-hidden')}}catch(e){}`;
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx5("script", { dangerouslySetInnerHTML: { __html: hideBannerScript } }),
    /* @__PURE__ */ jsxs2(
      "div",
      {
        className: cn(
          "nextra-banner-container nx-sticky nx-top-0 nx-z-20 nx-flex nx-items-center md:nx-relative",
          "nx-h-[var(--nextra-banner-height)] [body.nextra-banner-hidden_&]:nx-hidden",
          "nx-text-slate-50 dark:nx-text-white nx-bg-neutral-900 dark:nx-bg-[linear-gradient(1deg,#383838,#212121)]",
          "nx-px-2 ltr:nx-pl-10 rtl:nx-pr-10 print:nx-hidden"
        ),
        children: [
          /* @__PURE__ */ jsx5("div", { className: "nx-w-full nx-truncate nx-px-4 nx-text-center nx-font-medium nx-text-sm", children: renderComponent(banner.text) }),
          banner.dismissible && /* @__PURE__ */ jsx5(
            "button",
            {
              type: "button",
              "aria-label": "Dismiss banner",
              className: "nx-w-8 nx-h-8 nx-opacity-80 hover:nx-opacity-100",
              onClick: () => {
                try {
                  localStorage.setItem(banner.key, "0");
                } catch (e) {
                }
                document.body.classList.add("nextra-banner-hidden");
              },
              children: /* @__PURE__ */ jsx5(XIcon, { className: "nx-mx-auto nx-h-4 nx-w-4" })
            }
          )
        ]
      }
    )
  ] });
}

// src/components/bleed.tsx
import cn2 from "clsx";
import { jsx as jsx6 } from "react/jsx-runtime";
function Bleed({
  full,
  children
}) {
  return /* @__PURE__ */ jsx6(
    "div",
    {
      className: cn2(
        "nextra-bleed nx-relative -nx-mx-6 nx-mt-6 md:-nx-mx-8 2xl:-nx-mx-24",
        full && [
          // 'md:mx:[calc(-50vw+50%+8rem)',
          "ltr:xl:nx-ml-[calc(50%-50vw+16rem)] ltr:xl:nx-mr-[calc(50%-50vw)]",
          "rtl:xl:nx-ml-[calc(50%-50vw)] rtl:xl:nx-mr-[calc(50%-50vw+16rem)]"
        ]
      ),
      children
    }
  );
}

// src/components/breadcrumb.tsx
import cn3 from "clsx";
import { ArrowRightIcon } from "nextra/icons";
import { Fragment as Fragment2, useEffect, useState as useState3 } from "react";
import { jsx as jsx7, jsxs as jsxs3 } from "react/jsx-runtime";
function Breadcrumb({
  activePath
}) {
  const [mounted, setMounted] = useState3(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return null;
  }
  const filteredPath = activePath.filter((item) => item.title !== "index");
  const homeItem = { title: "Home", route: "/", withIndexPage: true };
  const breadcrumbPath = [homeItem, ...filteredPath];
  return /* @__PURE__ */ jsx7("div", { className: "nextra-breadcrumb nx-mt-1.5 nx-flex nx-items-center nx-gap-1 nx-overflow-hidden nx-text-sm nx-text-gray-500 dark:nx-text-gray-400 contrast-more:nx-text-current", children: breadcrumbPath.map((item, index) => {
    const isActive = index === breadcrumbPath.length - 1;
    return /* @__PURE__ */ jsxs3(Fragment2, { children: [
      index > 0 && /* @__PURE__ */ jsx7(ArrowRightIcon, { className: "nx-w-3.5 nx-shrink-0" }),
      /* @__PURE__ */ jsx7(
        "div",
        {
          className: cn3(
            "nx-whitespace-nowrap nx-transition-colors",
            isActive ? "nx-font-medium nx-text-gray-700 contrast-more:nx-font-bold contrast-more:nx-text-current dark:nx-text-gray-100 contrast-more:dark:nx-text-current" : [
              "nx-min-w-[24px] nx-overflow-hidden nx-text-ellipsis",
              "hover:nx-text-gray-900 dark:hover:nx-text-gray-100"
            ]
          ),
          title: item.title,
          children: !isActive ? /* @__PURE__ */ jsx7(Anchor, { href: item.route, children: item.title }) : item.title
        }
      )
    ] }, item.route + item.title);
  }) });
}

// src/components/collapse.tsx
import cn4 from "clsx";
import { useEffect as useEffect2, useRef as useRef3 } from "react";
import { jsx as jsx8 } from "react/jsx-runtime";
function Collapse({
  children,
  className,
  isOpen,
  horizontal = false
}) {
  const containerRef = useRef3(null);
  const innerRef = useRef3(null);
  const animationRef = useRef3(0);
  const initialOpen = useRef3(isOpen);
  const initialRender = useRef3(true);
  useEffect2(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    const animation = animationRef.current;
    if (animation) {
      clearTimeout(animation);
    }
    if (initialRender.current || !container || !inner) return;
    container.classList.toggle("nx-duration-500", !isOpen);
    container.classList.toggle("nx-duration-300", isOpen);
    if (horizontal) {
      inner.style.width = `${inner.clientWidth}px`;
      container.style.width = `${inner.clientWidth}px`;
    } else {
      container.style.height = `${inner.clientHeight}px`;
    }
    if (isOpen) {
      animationRef.current = window.setTimeout(() => {
        container.style.removeProperty("height");
      }, 300);
    } else {
      setTimeout(() => {
        if (horizontal) {
          container.style.width = "0px";
        } else {
          container.style.height = "0px";
        }
      }, 0);
    }
  }, [horizontal, isOpen]);
  useEffect2(() => {
    initialRender.current = false;
  }, []);
  return /* @__PURE__ */ jsx8(
    "div",
    {
      ref: containerRef,
      className: cn4(
        "nx-transform-gpu nx-overflow-hidden nx-transition-all nx-ease-in-out motion-reduce:nx-transition-none",
        isOpen ? "md:nx-w-64" : "md:nx-w-20",
        className
      ),
      style: initialOpen.current || horizontal ? void 0 : { height: 0 },
      children: /* @__PURE__ */ jsx8(
        "div",
        {
          ref: innerRef,
          className: cn4(
            "nx-transition-opacity nx-duration-500 nx-ease-in-out motion-reduce:nx-transition-none",
            isOpen ? "nx-opacity-100 md:nx-w-64" : "nx-opacity-0 md:nx-w-20",
            className
          ),
          children
        }
      )
    }
  );
}

// src/components/flexsearch.tsx
import cn7 from "clsx";
import FlexSearch from "flexsearch";
import { useRouter as useRouter2 } from "next/router";
import { useCallback as useCallback3, useState as useState5 } from "react";

// src/components/highlight-matches.tsx
import escapeStringRegexp from "escape-string-regexp";
import { memo } from "react";
import { Fragment as Fragment3, jsx as jsx9, jsxs as jsxs4 } from "react/jsx-runtime";
var HighlightMatches = memo(function HighlightMatches2({
  value,
  match
}) {
  if (!value) {
    return null;
  }
  const escapedSearch = escapeStringRegexp(match.trim());
  const regexp = new RegExp(escapedSearch.replaceAll(/\s+/g, "|"), "ig");
  let result;
  let lastIndex = 0;
  const content = [];
  while (result = regexp.exec(value)) {
    const before = value.slice(lastIndex, result.index);
    const matchText = value.slice(result.index, regexp.lastIndex);
    if (before) {
      content.push(before);
    }
    content.push(
      /* @__PURE__ */ jsx9("span", { className: "nx-text-primary-600", children: matchText }, result.index)
    );
    lastIndex = regexp.lastIndex;
  }
  if (lastIndex < value.length) {
    content.push(value.slice(lastIndex));
  }
  const renderContent = (content2) => {
    const renderedContent = [];
    content2.forEach((part, index) => {
      if (typeof part === "string") {
        const lines = part.split("\n");
        lines.forEach((line, idx) => {
          renderedContent.push(
            /* @__PURE__ */ jsxs4("span", { style: { "marginBottom": "1rem" }, children: [
              line,
              idx < lines.length - 1 && /* @__PURE__ */ jsx9("div", { style: { height: "0.3rem" } })
            ] }, `${index}-${idx}`)
          );
        });
      } else {
        renderedContent.push(part);
      }
    });
    return renderedContent;
  };
  return /* @__PURE__ */ jsx9(Fragment3, { children: renderContent(content) });
});

// src/components/search.tsx
import { Transition } from "@headlessui/react";
import cn6 from "clsx";
import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import { InformationCircleIcon, SpinnerIcon } from "nextra/icons";
import { Fragment as Fragment4, useCallback as useCallback2, useEffect as useEffect3, useRef as useRef4, useState as useState4 } from "react";

// src/components/input.tsx
import cn5 from "clsx";
import { forwardRef as forwardRef2 } from "react";
import { jsx as jsx10, jsxs as jsxs5 } from "react/jsx-runtime";
var Input = forwardRef2(
  (_a, forwardedRef) => {
    var _b = _a, { className, suffix } = _b, props = __objRest(_b, ["className", "suffix"]);
    return /* @__PURE__ */ jsxs5("div", { className: "nx-relative nx-flex nx-items-center nx-text-gray-900 contrast-more:nx-text-gray-800 dark:nx-text-gray-300 contrast-more:dark:nx-text-gray-300", children: [
      /* @__PURE__ */ jsx10(
        "input",
        __spreadValues({
          ref: forwardedRef,
          spellCheck: false,
          className: cn5(
            className,
            "nx-block nx-w-full nx-appearance-none nx-rounded-lg nx-px-3 nx-py-2 nx-transition-colors",
            "nx-text-base nx-leading-tight md:nx-text-sm",
            "nx-bg-black/[.05] dark:nx-bg-gray-50/10",
            "focus:nx-bg-white dark:focus:nx-bg-dark",
            "placeholder:nx-text-gray-500 dark:placeholder:nx-text-gray-400",
            "contrast-more:nx-border contrast-more:nx-border-current"
          )
        }, props)
      ),
      suffix
    ] });
  }
);
Input.displayName = "Input";

// src/components/search.tsx
import { Fragment as Fragment5, jsx as jsx11, jsxs as jsxs6 } from "react/jsx-runtime";
var INPUTS = ["input", "select", "button", "textarea"];
function Search({
  className,
  overlayClassName,
  value,
  onChange,
  onActive,
  loading,
  error,
  results
}) {
  const [show, setShow] = useState4(false);
  const config = useConfig();
  const [active, setActive] = useState4(0);
  const router = useRouter();
  const { setMenu } = useMenu();
  const input = useRef4(null);
  const ulRef = useRef4(null);
  const [focused, setFocused] = useState4(false);
  const [composition, setComposition] = useState4(true);
  useEffect3(() => {
    setActive(0);
  }, [value]);
  useEffect3(() => {
    const down = (e) => {
      const activeElement = document.activeElement;
      const tagName = activeElement == null ? void 0 : activeElement.tagName.toLowerCase();
      if (!input.current || !tagName || INPUTS.includes(tagName) || (activeElement == null ? void 0 : activeElement.isContentEditable))
        return;
      if (e.key === "/" || e.key === "k" && (e.metaKey || /* for non-Mac */
      e.ctrlKey)) {
        e.preventDefault();
        input.current.focus({ preventScroll: true });
      } else if (e.key === "Escape") {
        setShow(false);
        input.current.blur();
      }
    };
    window.addEventListener("keydown", down);
    return () => {
      window.removeEventListener("keydown", down);
    };
  }, []);
  const finishSearch = useCallback2(() => {
    var _a;
    (_a = input.current) == null ? void 0 : _a.blur();
    onChange("");
    setShow(false);
    setMenu(false);
  }, [onChange, setMenu]);
  const handleActive = useCallback2(
    (e) => {
      const { index } = e.currentTarget.dataset;
      setActive(Number(index));
    },
    []
  );
  const handleKeyDown = useCallback2(
    function(e) {
      var _a, _b, _c;
      switch (e.key) {
        case "ArrowDown": {
          if (active + 1 < results.length) {
            const el = (_a = ulRef.current) == null ? void 0 : _a.querySelector(
              `li:nth-of-type(${active + 2}) > a`
            );
            if (el) {
              e.preventDefault();
              handleActive({ currentTarget: el });
              el.focus();
            }
          }
          break;
        }
        case "ArrowUp": {
          if (active - 1 >= 0) {
            const el = (_b = ulRef.current) == null ? void 0 : _b.querySelector(
              `li:nth-of-type(${active}) > a`
            );
            if (el) {
              e.preventDefault();
              handleActive({ currentTarget: el });
              el.focus();
            }
          }
          break;
        }
        case "Enter": {
          const result = results[active];
          if (result && composition) {
            void router.push(result.route);
            finishSearch();
          }
          break;
        }
        case "Escape": {
          setShow(false);
          (_c = input.current) == null ? void 0 : _c.blur();
          break;
        }
      }
    },
    [active, results, router, finishSearch, handleActive, composition]
  );
  const mounted = useMounted();
  const renderList = show && Boolean(value);
  const icon = /* @__PURE__ */ jsx11(
    Transition,
    {
      show: mounted && (!show || Boolean(value)),
      as: Fragment4,
      enter: "nx-transition-opacity",
      enterFrom: "nx-opacity-0",
      enterTo: "nx-opacity-100",
      leave: "nx-transition-opacity",
      leaveFrom: "nx-opacity-100",
      leaveTo: "nx-opacity-0",
      children: /* @__PURE__ */ jsx11(
        "kbd",
        {
          className: cn6(
            "nx-absolute nx-my-1.5 nx-select-none ltr:nx-right-1.5 rtl:nx-left-1.5",
            "nx-h-5 nx-rounded nx-bg-white nx-px-1.5 nx-font-mono nx-text-[10px] nx-font-medium nx-text-gray-500",
            "nx-border dark:nx-border-gray-100/20 dark:nx-bg-dark/50",
            "contrast-more:nx-border-current contrast-more:nx-text-current contrast-more:dark:nx-border-current",
            "nx-items-center nx-gap-1 nx-transition-opacity",
            value ? "nx-z-20 nx-flex nx-cursor-pointer hover:nx-opacity-70" : "nx-pointer-events-none nx-hidden sm:nx-flex"
          ),
          title: value ? "Clear" : void 0,
          onClick: () => {
            onChange("");
          },
          children: value && focused ? "ESC" : mounted && (navigator.userAgent.includes("Macintosh") ? /* @__PURE__ */ jsxs6(Fragment5, { children: [
            /* @__PURE__ */ jsx11("span", { className: "nx-text-xs", children: "\u2318" }),
            "K"
          ] }) : "CTRL K")
        }
      )
    }
  );
  const handleComposition = useCallback2(
    (e) => {
      setComposition(e.type === "compositionend");
    },
    []
  );
  return /* @__PURE__ */ jsxs6("div", { className: cn6("nextra-search nx-relative md:nx-w-64", className), children: [
    renderList && /* @__PURE__ */ jsx11(
      "div",
      {
        className: "nx-fixed nx-inset-0 nx-z-10",
        onClick: () => setShow(false)
      }
    ),
    /* @__PURE__ */ jsx11(
      Input,
      {
        ref: input,
        value,
        onChange: (e) => {
          const { value: value2 } = e.target;
          onChange(value2);
          setShow(Boolean(value2));
        },
        onFocus: () => {
          onActive == null ? void 0 : onActive(true);
          setFocused(true);
        },
        onBlur: () => {
          setFocused(false);
        },
        onCompositionStart: handleComposition,
        onCompositionEnd: handleComposition,
        type: "search",
        placeholder: renderString(config.search.placeholder),
        onKeyDown: handleKeyDown,
        suffix: icon
      }
    ),
    /* @__PURE__ */ jsx11(
      Transition,
      {
        show: renderList,
        as: Transition.Child,
        leave: "nx-transition-opacity nx-duration-100",
        leaveFrom: "nx-opacity-100",
        leaveTo: "nx-opacity-0",
        children: /* @__PURE__ */ jsx11(
          "ul",
          {
            className: cn6(
              "nextra-scrollbar",
              // Using bg-white as background-color when the browser didn't support backdrop-filter
              "nx-border nx-border-gray-200 nx-bg-white nx-text-gray-100 dark:nx-border-neutral-800 dark:nx-bg-neutral-900",
              "nx-absolute nx-top-full nx-z-20 nx-mt-2 nx-overflow-auto nx-overscroll-contain nx-rounded-xl nx-py-2.5 nx-shadow-xl",
              "nx-max-h-[min(calc(50vh-11rem-env(safe-area-inset-bottom)),400px)]",
              "md:nx-max-h-[min(calc(100vh-5rem-env(safe-area-inset-bottom)),400px)]",
              "nx-inset-x-0 ltr:md:nx-left-auto rtl:md:nx-right-auto",
              "contrast-more:nx-border contrast-more:nx-border-gray-900 contrast-more:dark:nx-border-gray-50",
              overlayClassName
            ),
            ref: ulRef,
            style: {
              transition: "max-height .2s ease",
              // don't work with tailwindcss
              maxHeight: "80vh"
            },
            children: error ? /* @__PURE__ */ jsxs6("span", { className: "nx-flex nx-select-none nx-justify-center nx-gap-2 nx-p-8 nx-text-center nx-text-sm nx-text-red-500", children: [
              /* @__PURE__ */ jsx11(InformationCircleIcon, { className: "nx-h-5 nx-w-5" }),
              renderString(config.search.error)
            ] }) : loading ? /* @__PURE__ */ jsxs6("span", { className: "nx-flex nx-select-none nx-justify-center nx-gap-2 nx-p-8 nx-text-center nx-text-sm nx-text-gray-400", children: [
              /* @__PURE__ */ jsx11(SpinnerIcon, { className: "nx-h-5 nx-w-5 nx-animate-spin" }),
              renderComponent(config.search.loading)
            ] }) : results.length > 0 ? results.map(({ route, prefix, children, id }, i) => /* @__PURE__ */ jsxs6(Fragment4, { children: [
              prefix,
              /* @__PURE__ */ jsx11(
                "li",
                {
                  className: cn6(
                    "nx-mx-2.5 nx-break-words nx-rounded-md",
                    "contrast-more:nx-border",
                    i === active ? "nx-bg-primary-500/10 nx-text-primary-600 contrast-more:nx-border-primary-500" : "nx-text-gray-800 contrast-more:nx-border-transparent dark:nx-text-gray-300"
                  ),
                  children: /* @__PURE__ */ jsx11(
                    Anchor,
                    {
                      className: "nx-block nx-scroll-m-12 nx-px-2.5 nx-py-2",
                      href: route.replace(/(.*)(\.\w{2,3})(#[\s\S]*)?$/, "$1$3"),
                      "data-index": i,
                      onFocus: handleActive,
                      onMouseMove: handleActive,
                      onClick: finishSearch,
                      onKeyDown: handleKeyDown,
                      children
                    }
                  )
                }
              )
            ] }, id)) : renderComponent(config.search.emptyResult)
          }
        )
      }
    )
  ] });
}

// src/components/flexsearch.tsx
import { Fragment as Fragment6, jsx as jsx12, jsxs as jsxs7 } from "react/jsx-runtime";
var indexes = {};
var removeDiacritics = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
var isVerse = (paragraph) => {
  const lines = paragraph.trim().split("\n");
  if (lines.length < 2) return false;
  const lastLine = lines[lines.length - 1].trim();
  const otherLines = lines.slice(0, -1);
  const lastLineValid = /[.?"-]$/.test(lastLine);
  const otherLinesValid = otherLines.every(
    (line) => /[,;:.?]?$/i.test(line.trim())
  );
  return lastLineValid && otherLinesValid;
};
function splitByPatterns(text) {
  const patterns = [
    { regex: /\.""(?=[A-Z])/g, offset: 2 },
    { regex: /\?""(?=[A-Z])/g, offset: 2 },
    { regex: /:"(?=[A-Z])/g, offset: 1 },
    { regex: /\.'(?=[A-Z])/g, offset: 2 },
    { regex: /\."(?=[A-Z])/g, offset: 2 },
    { regex: /\.(?=[A-Z])/g, offset: 1 }
  ];
  function splitTextByPatterns(text2, patterns2) {
    let paragraphs = [text2];
    patterns2.forEach((pattern) => {
      let newParagraphs = [];
      paragraphs.forEach((paragraph) => {
        let lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(paragraph)) !== null) {
          const matchIndex = match.index + pattern.offset;
          newParagraphs.push(paragraph.slice(lastIndex, matchIndex).trim());
          lastIndex = matchIndex;
        }
        if (lastIndex < paragraph.length) {
          newParagraphs.push(paragraph.slice(lastIndex).trim());
        }
      });
      paragraphs = newParagraphs;
    });
    return paragraphs;
  }
  return splitTextByPatterns(text, patterns);
}
var splitContentIntoParagraphs = (content) => {
  const rawParagraphs = splitByPatterns(content);
  const paragraphs = [];
  rawParagraphs.forEach((rawParagraph) => {
    const lines = rawParagraph.split("\n").map((line) => line.trim());
    let currentParagraph = "";
    lines.forEach((line, index) => {
      if (currentParagraph) {
        currentParagraph += "\n" + line;
      } else {
        currentParagraph = line;
      }
      if (index === lines.length - 1 || lines[index + 1] === "") {
        if (isVerse(currentParagraph)) {
          paragraphs.push(currentParagraph);
        } else {
          paragraphs.push(
            ...currentParagraph.split("\n\n").map(removeDiacritics)
          );
        }
        currentParagraph = "";
      }
    });
  });
  return paragraphs.filter((paragraph) => paragraph.trim().length > 0);
};
var getDiscourseId = (url) => {
  const parts = url.split("/");
  const lastPart = parts[parts.length - 1];
  return lastPart.replace(/(.*)(\.\w{2,3})(#[\s\S]*)?$/, "$1$3");
};
var getFormattedDiscourseId = (url) => {
  const discourseId = getDiscourseId(url);
  const match = discourseId.match(/^([a-zA-Z]+)([0-9]+(?:[\.\-][0-9]+)*)$/);
  if (match) {
    const [_, text, number] = match;
    return `${text.toUpperCase()} ${number}`;
  }
  return discourseId;
};
var loadIndexesPromises = /* @__PURE__ */ new Map();
var loadIndexes = (basePath, locale) => {
  const key = basePath + "@" + locale;
  if (loadIndexesPromises.has(key)) {
    return loadIndexesPromises.get(key);
  }
  const promise = loadIndexesImpl(basePath, locale);
  loadIndexesPromises.set(key, promise);
  return promise;
};
var loadIndexesImpl = (basePath, locale) => __async(void 0, null, function* () {
  const response = yield fetch(
    `${basePath}/_next/static/chunks/nextra-data-${locale}.json`
  );
  const searchData = yield response.json();
  const pageIndex = new FlexSearch.Document({
    cache: 100,
    tokenize: "full",
    document: {
      id: "id",
      index: "content",
      store: ["discourseId", "title"]
    },
    context: {
      resolution: 9,
      depth: 2,
      bidirectional: true
    }
  });
  const sectionIndex = new FlexSearch.Document({
    cache: 100,
    tokenize: "full",
    document: {
      id: "id",
      index: "content",
      tag: "pageId",
      store: ["title", "content", "url", "display"]
    },
    context: {
      resolution: 9,
      depth: 2,
      bidirectional: true
    }
  });
  let pageId = 0;
  for (const [route, structurizedData] of Object.entries(searchData)) {
    let pageContent = "";
    ++pageId;
    for (const [key, content] of Object.entries(structurizedData.data)) {
      const [headingId, headingValue] = key.split("#");
      const url = route + (headingId ? "#" + headingId : "");
      const pageTitle = removeDiacritics(structurizedData.title);
      const title = removeDiacritics(headingValue || structurizedData.title);
      const paragraphs = splitContentIntoParagraphs(content);
      const revisedContent = removeDiacritics(paragraphs.join("\n\n"));
      sectionIndex.add({
        id: url,
        url,
        title,
        pageId: `page_${pageId}`,
        content: getDiscourseId(route) + " " + getFormattedDiscourseId(route) + " " + pageTitle + " " + title + " " + revisedContent
      });
      pageContent += ` ${title} ${paragraphs.join(" ")}`;
    }
    pageContent += `${getDiscourseId(route)} ${getFormattedDiscourseId(
      route
    )} ${removeDiacritics(structurizedData.title)}`;
    pageIndex.add({
      id: pageId,
      discourseId: getFormattedDiscourseId(route),
      title: removeDiacritics(structurizedData.title),
      content: pageContent
      // Already normalized
    });
  }
  indexes[locale] = [pageIndex, sectionIndex];
});
function Flexsearch({
  className
}) {
  const { locale = DEFAULT_LOCALE, basePath } = useRouter2();
  const [loading, setLoading] = useState5(false);
  const [error, setError] = useState5(false);
  const [results, setResults] = useState5([]);
  const [search, setSearch] = useState5("");
  const doSearch = (search2) => {
    var _a, _b;
    if (!search2) return;
    const [pageIndex, sectionIndex] = indexes[locale];
    const normalizedSearch = removeDiacritics(search2);
    const pageResults = ((_a = pageIndex.search(normalizedSearch, 5, {
      enrich: true,
      suggest: true
    })[0]) == null ? void 0 : _a.result) || [];
    const results2 = [];
    const pageTitleMatches = {};
    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];
      pageTitleMatches[i] = 0;
      const sectionResults = ((_b = sectionIndex.search(normalizedSearch, 5, {
        enrich: true,
        suggest: true,
        tag: `page_${result.id}`
      })[0]) == null ? void 0 : _b.result) || [];
      let isFirstItemOfPage = true;
      const occurred = {};
      for (let j = 0; j < sectionResults.length; j++) {
        const { doc } = sectionResults[j];
        const isMatchingTitle = doc.display !== void 0;
        if (isMatchingTitle) {
          pageTitleMatches[i]++;
        }
        const { url, title } = doc;
        const content = doc.display || doc.content;
        const urlId = result.doc.discourseId;
        const urlIdNoSpaces = urlId.replace(/\s+/g, "");
        const titleForRegex = result.doc.title.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const sectionTitleForRegex = doc.title.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const pattern = new RegExp(
          `${urlId.replace(
            /[.*+?^${}()|[\]\\]/gi,
            "\\$&"
          )}|${urlIdNoSpaces.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}|${titleForRegex}|${sectionTitleForRegex}`,
          "gi"
        );
        let titleString = urlId;
        if (urlId !== result.doc.title) {
          titleString += `: ${result.doc.title}`;
        }
        const cleanedContent = content.replace(pattern, "");
        if (occurred[url + "@" + cleanedContent]) continue;
        occurred[url + "@" + cleanedContent] = true;
        results2.push({
          _page_rk: i,
          _section_rk: j,
          route: url,
          prefix: isFirstItemOfPage && /* @__PURE__ */ jsx12(
            "div",
            {
              className: cn7(
                "nx-mx-2.5 nx-mb-2 nx-mt-6 nx-select-none nx-border-b nx-border-black/10 nx-px-2.5 nx-pb-1.5 nx-text-xs nx-font-semibold nx-uppercase nx-text-gray-500 first:nx-mt-0 dark:nx-border-white/20 dark:nx-text-gray-300",
                "contrast-more:nx-border-gray-600 contrast-more:nx-text-gray-900 contrast-more:dark:nx-border-gray-50 contrast-more:dark:nx-text-gray-50"
              ),
              children: titleString
            }
          ),
          children: /* @__PURE__ */ jsxs7(Fragment6, { children: [
            /* @__PURE__ */ jsx12("div", { className: "nx-text-base nx-font-semibold nx-leading-5", children: /* @__PURE__ */ jsx12(HighlightMatches, { match: search2, value: title }) }),
            cleanedContent && /* @__PURE__ */ jsx12("div", { className: "excerpt nx-mt-1 nx-text-sm nx-leading-[1.35rem] nx-text-gray-600 dark:nx-text-gray-400 contrast-more:dark:nx-text-gray-50", children: /* @__PURE__ */ jsx12(HighlightMatches, { match: search2, value: cleanedContent }) })
          ] })
        });
        isFirstItemOfPage = false;
      }
    }
    setResults(
      results2.sort((a, b) => {
        if (a._page_rk === b._page_rk) {
          return a._section_rk - b._section_rk;
        }
        if (pageTitleMatches[a._page_rk] !== pageTitleMatches[b._page_rk]) {
          return pageTitleMatches[b._page_rk] - pageTitleMatches[a._page_rk];
        }
        return a._page_rk - b._page_rk;
      }).map((res) => ({
        id: `${res._page_rk}_${res._section_rk}`,
        route: res.route,
        prefix: res.prefix,
        children: res.children
      }))
    );
  };
  const preload = useCallback3(
    (active) => __async(this, null, function* () {
      if (active && !indexes[locale]) {
        setLoading(true);
        try {
          yield loadIndexes(basePath, locale);
        } catch (e) {
          setError(true);
        }
        setLoading(false);
      }
    }),
    [locale, basePath]
  );
  const handleChange = (value) => __async(this, null, function* () {
    setSearch(value);
    if (loading) {
      return;
    }
    if (!indexes[locale]) {
      setLoading(true);
      try {
        yield loadIndexes(basePath, locale);
      } catch (e) {
        setError(true);
      }
      setLoading(false);
    }
    doSearch(value);
  });
  return /* @__PURE__ */ jsx12(
    Search,
    {
      loading,
      error,
      value: search,
      onChange: handleChange,
      onActive: preload,
      className,
      overlayClassName: "nx-w-screen nx-min-h-[100px] nx-max-w-[min(calc(100vw-2rem),calc(100%+20rem))]",
      results
    }
  );
}

// src/components/footer.tsx
import cn9 from "clsx";

// src/components/locale-switch.tsx
import { addBasePath } from "next/dist/client/add-base-path";
import { useRouter as useRouter3 } from "next/router";
import { GlobeIcon } from "nextra/icons";

// src/components/select.tsx
import { Listbox, Transition as Transition2 } from "@headlessui/react";
import cn8 from "clsx";
import { useMounted as useMounted2 } from "nextra/hooks";
import { CheckIcon } from "nextra/icons";
import { createPortal } from "react-dom";
import { jsx as jsx13, jsxs as jsxs8 } from "react/jsx-runtime";
function Select({
  options,
  selected,
  onChange,
  title,
  className
}) {
  const [trigger, container] = usePopper({
    strategy: "fixed",
    placement: "top-start",
    modifiers: [
      { name: "offset", options: { offset: [0, 10] } },
      {
        name: "sameWidth",
        enabled: true,
        fn({ state }) {
          state.styles.popper.minWidth = `${state.rects.reference.width}px`;
        },
        phase: "beforeWrite",
        requires: ["computeStyles"]
      }
    ]
  });
  return /* @__PURE__ */ jsx13(Listbox, { value: selected, onChange, children: ({ open }) => /* @__PURE__ */ jsxs8(
    Listbox.Button,
    {
      ref: trigger,
      title,
      className: cn8(
        "nx-h-7 nx-rounded-md nx-px-2 nx-text-left nx-text-xs nx-font-medium nx-text-gray-600 nx-transition-colors dark:nx-text-gray-400",
        open ? "nx-bg-gray-200 nx-text-gray-900 dark:nx-bg-primary-100/10 dark:nx-text-gray-50" : "hover:nx-bg-gray-100 hover:nx-text-gray-900 dark:hover:nx-bg-primary-100/5 dark:hover:nx-text-gray-50",
        className
      ),
      children: [
        selected.name,
        /* @__PURE__ */ jsx13(Portal, { children: /* @__PURE__ */ jsx13(
          Transition2,
          {
            ref: container,
            show: open,
            as: Listbox.Options,
            className: "nx-z-20 nx-max-h-64 nx-overflow-auto nx-rounded-md nx-ring-1 nx-ring-black/5 nx-bg-white nx-py-1 nx-text-sm nx-shadow-lg dark:nx-ring-white/20 dark:nx-bg-neutral-800",
            leave: "nx-transition-opacity",
            leaveFrom: "nx-opacity-100",
            leaveTo: "nx-opacity-0",
            children: options.map((option) => /* @__PURE__ */ jsxs8(
              Listbox.Option,
              {
                value: option,
                className: ({ active }) => cn8(
                  active ? "nx-bg-primary-50 nx-text-primary-600 dark:nx-bg-primary-500/10" : "nx-text-gray-800 dark:nx-text-gray-100",
                  "nx-relative nx-cursor-pointer nx-whitespace-nowrap nx-py-1.5",
                  "nx-transition-colors ltr:nx-pl-3 ltr:nx-pr-9 rtl:nx-pr-3 rtl:nx-pl-9"
                ),
                children: [
                  option.name,
                  option.key === selected.key && /* @__PURE__ */ jsx13("span", { className: "nx-absolute nx-inset-y-0 nx-flex nx-items-center ltr:nx-right-3 rtl:nx-left-3", children: /* @__PURE__ */ jsx13(CheckIcon, {}) })
                ]
              },
              option.key
            ))
          }
        ) })
      ]
    }
  ) });
}
function Portal(props) {
  const mounted = useMounted2();
  if (!mounted) return null;
  return createPortal(props.children, document.body);
}

// src/components/locale-switch.tsx
import { jsx as jsx14, jsxs as jsxs9 } from "react/jsx-runtime";
function LocaleSwitch({
  lite,
  className
}) {
  const config = useConfig();
  const { locale, asPath } = useRouter3();
  const options = config.i18n;
  if (!options.length) return null;
  const selected = options.find((l) => locale === l.locale);
  return /* @__PURE__ */ jsx14(
    Select,
    {
      title: "Change language",
      className,
      onChange: (option) => {
        const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3);
        document.cookie = `NEXT_LOCALE=${option.key}; expires=${date.toUTCString()}; path=/`;
        location.href = addBasePath(asPath);
      },
      selected: {
        key: (selected == null ? void 0 : selected.locale) || "",
        name: /* @__PURE__ */ jsxs9("span", { className: "nx-flex nx-items-center nx-gap-2", children: [
          /* @__PURE__ */ jsx14(GlobeIcon, {}),
          /* @__PURE__ */ jsx14("span", { className: lite ? "nx-hidden" : "", children: selected == null ? void 0 : selected.text })
        ] })
      },
      options: options.map((l) => ({
        key: l.locale,
        name: l.text
      }))
    }
  );
}

// src/components/footer.tsx
import { jsx as jsx15, jsxs as jsxs10 } from "react/jsx-runtime";
function Footer({ menu }) {
  const config = useConfig();
  return /* @__PURE__ */ jsxs10("footer", { className: "nx-bg-gray-100 nx-pb-[env(safe-area-inset-bottom)] dark:nx-bg-neutral-900 print:nx-bg-transparent", children: [
    /* @__PURE__ */ jsxs10(
      "div",
      {
        className: cn9(
          "nx-mx-auto nx-flex nx-max-w-[90rem] nx-gap-2 nx-py-2 nx-px-4",
          menu && (config.i18n.length > 0 || config.darkMode) ? "nx-flex" : "nx-hidden"
        ),
        children: [
          /* @__PURE__ */ jsx15(LocaleSwitch, {}),
          config.darkMode && renderComponent(config.themeSwitch.component)
        ]
      }
    ),
    /* @__PURE__ */ jsx15("hr", { className: "dark:nx-border-neutral-800" }),
    /* @__PURE__ */ jsx15(
      "div",
      {
        className: cn9(
          "nx-mx-auto nx-flex nx-max-w-[90rem] nx-justify-center nx-py-12 nx-text-gray-600 dark:nx-text-gray-400 md:nx-justify-start",
          "nx-pl-[max(env(safe-area-inset-left),1.5rem)] nx-pr-[max(env(safe-area-inset-right),1.5rem)]"
        ),
        children: renderComponent(config.footer.text)
      }
    )
  ] });
}

// src/components/head.tsx
import { NextSeo } from "next-seo";
import { useTheme } from "next-themes";
import NextHead from "next/head";
import { useMounted as useMounted3 } from "nextra/hooks";
import { Fragment as Fragment7, jsx as jsx16, jsxs as jsxs11 } from "react/jsx-runtime";
function Head() {
  var _a;
  const config = useConfig();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted3();
  const head = typeof config.head === "function" ? config.head({}) : config.head;
  const { primaryHue: hue, primarySaturation: saturation } = config;
  const { dark: darkHue, light: lightHue } = typeof hue === "number" ? { dark: hue, light: hue } : hue;
  const { dark: darkSaturation, light: lightSaturation } = typeof saturation === "number" ? { dark: saturation, light: saturation } : saturation;
  const frontMatter = config.frontMatter;
  return /* @__PURE__ */ jsxs11(Fragment7, { children: [
    /* @__PURE__ */ jsx16(
      NextSeo,
      __spreadValues({
        title: config.title,
        description: frontMatter.description,
        canonical: frontMatter.canonical,
        openGraph: frontMatter.openGraph
      }, (_a = config.useNextSeoProps) == null ? void 0 : _a.call(config))
    ),
    /* @__PURE__ */ jsxs11(NextHead, { children: [
      config.faviconGlyph ? /* @__PURE__ */ jsx16(
        "link",
        {
          rel: "icon",
          href: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50' y='.9em' font-size='90' text-anchor='middle'>${config.faviconGlyph}</text><style>text{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";fill:black}@media(prefers-color-scheme:dark){text{fill:white}}</style></svg>`
        }
      ) : null,
      mounted ? /* @__PURE__ */ jsx16(
        "meta",
        {
          name: "theme-color",
          content: resolvedTheme === "dark" ? "#111" : "#fff"
        }
      ) : /* @__PURE__ */ jsxs11(Fragment7, { children: [
        /* @__PURE__ */ jsx16(
          "meta",
          {
            name: "theme-color",
            content: "#fff",
            media: "(prefers-color-scheme: light)"
          }
        ),
        /* @__PURE__ */ jsx16(
          "meta",
          {
            name: "theme-color",
            content: "#111",
            media: "(prefers-color-scheme: dark)"
          }
        )
      ] }),
      /* @__PURE__ */ jsx16(
        "meta",
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1.0, viewport-fit=cover"
        }
      ),
      /* @__PURE__ */ jsx16("style", { children: `
        :root {
          --nextra-primary-hue: ${lightHue}deg;
          --nextra-primary-saturation: ${lightSaturation}%;
          --nextra-navbar-height: 4rem;
          --nextra-menu-height: 3.75rem;
          --nextra-banner-height: 2.5rem;
        }
        
        .dark {
          --nextra-primary-hue: ${darkHue}deg;
          --nextra-primary-saturation: ${darkSaturation}%;
        }
      ` }),
      head
    ] })
  ] });
}

// src/components/nav-links.tsx
import cn10 from "clsx";
import { ArrowRightIcon as ArrowRightIcon2 } from "nextra/icons";
import { jsx as jsx17, jsxs as jsxs12 } from "react/jsx-runtime";
var classes = {
  link: cn10(
    "nx-flex nx-max-w-[50%] nx-items-center nx-gap-1 nx-py-4 nx-text-base nx-font-medium nx-text-gray-600 nx-transition-colors [word-break:break-word] hover:nx-text-primary-600 dark:nx-text-gray-300 md:nx-text-lg"
  ),
  icon: cn10("nx-inline nx-h-5 nx-shrink-0")
};
var NavLinks = ({
  flatDirectories,
  currentIndex
}) => {
  const config = useConfig();
  const nav = config.navigation;
  const navigation = typeof nav === "boolean" ? { prev: nav, next: nav } : nav;
  let prev = navigation.prev && flatDirectories[currentIndex - 1];
  let next2 = navigation.next && flatDirectories[currentIndex + 1];
  if (prev && !prev.isUnderCurrentDocsTree) prev = false;
  if (next2 && !next2.isUnderCurrentDocsTree) next2 = false;
  if (!prev && !next2) return null;
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      className: cn10(
        "nx-mb-8 nx-flex nx-items-center nx-border-t nx-pt-8 dark:nx-border-neutral-800",
        "contrast-more:nx-border-neutral-400 dark:contrast-more:nx-border-neutral-400",
        "print:nx-hidden"
      ),
      children: [
        prev && /* @__PURE__ */ jsxs12(
          Anchor,
          {
            href: prev.route,
            title: prev.title,
            className: cn10(classes.link, "ltr:nx-pr-4 rtl:nx-pl-4"),
            children: [
              /* @__PURE__ */ jsx17(ArrowRightIcon2, { className: cn10(classes.icon, "ltr:nx-rotate-180") }),
              prev.title
            ]
          }
        ),
        next2 && /* @__PURE__ */ jsxs12(
          Anchor,
          {
            href: next2.route,
            title: next2.title,
            className: cn10(
              classes.link,
              "ltr:nx-ml-auto ltr:nx-pl-4 ltr:nx-text-right rtl:nx-mr-auto rtl:nx-pr-4 rtl:nx-text-left"
            ),
            children: [
              next2.title,
              /* @__PURE__ */ jsx17(ArrowRightIcon2, { className: cn10(classes.icon, "rtl:nx-rotate-180") })
            ]
          }
        )
      ]
    }
  );
};

// src/components/navbar.tsx
import { Menu, Transition as Transition3 } from "@headlessui/react";
import cn11 from "clsx";
import { useFSRoute } from "nextra/hooks";
import { ArrowRightIcon as ArrowRightIcon3, MenuIcon } from "nextra/icons";
import { jsx as jsx18, jsxs as jsxs13 } from "react/jsx-runtime";
var classes2 = {
  link: cn11(
    "nx-text-sm contrast-more:nx-text-gray-700 contrast-more:dark:nx-text-gray-100"
  ),
  active: cn11("nx-font-medium nx-subpixel-antialiased"),
  inactive: cn11(
    "nx-text-gray-600 hover:nx-text-gray-800 dark:nx-text-gray-400 dark:hover:nx-text-gray-200"
  )
};
function NavbarMenu({
  className,
  menu,
  children
}) {
  const { items } = menu;
  const routes = Object.fromEntries(
    (menu.children || []).map((route) => [route.name, route])
  );
  return /* @__PURE__ */ jsx18("div", { className: "nx-relative nx-inline-block", children: /* @__PURE__ */ jsxs13(Menu, { children: [
    /* @__PURE__ */ jsx18(
      Menu.Button,
      {
        className: cn11(
          className,
          "-nx-ml-2 nx-hidden nx-items-center nx-whitespace-nowrap nx-rounded nx-p-2 md:nx-inline-flex",
          classes2.inactive
        ),
        children
      }
    ),
    /* @__PURE__ */ jsx18(
      Transition3,
      {
        leave: "nx-transition-opacity",
        leaveFrom: "nx-opacity-100",
        leaveTo: "nx-opacity-0",
        children: /* @__PURE__ */ jsx18(Menu.Items, { className: "nx-absolute nx-right-0 nx-z-20 nx-mt-1 nx-max-h-64 nx-min-w-full nx-overflow-auto nx-rounded-md nx-ring-1 nx-ring-black/5 nx-bg-white nx-py-1 nx-text-sm nx-shadow-lg dark:nx-ring-white/20 dark:nx-bg-neutral-800", children: Object.entries(items || {}).map(([key, item]) => {
          var _a;
          return /* @__PURE__ */ jsx18(Menu.Item, { children: /* @__PURE__ */ jsx18(
            Anchor,
            {
              href: item.href || ((_a = routes[key]) == null ? void 0 : _a.route) || menu.route + "/" + key,
              className: cn11(
                "nx-relative nx-hidden nx-w-full nx-select-none nx-whitespace-nowrap nx-text-gray-600 hover:nx-text-gray-900 dark:nx-text-gray-400 dark:hover:nx-text-gray-100 md:nx-inline-block",
                "nx-py-1.5 nx-transition-colors ltr:nx-pl-3 ltr:nx-pr-9 rtl:nx-pr-3 rtl:nx-pl-9"
              ),
              newWindow: item.newWindow,
              children: item.title || key
            }
          ) }, key);
        }) })
      }
    )
  ] }) });
}
function Navbar({ flatDirectories, items }) {
  const config = useConfig();
  const activeRoute = useFSRoute();
  const { menu, setMenu } = useMenu();
  return /* @__PURE__ */ jsxs13("div", { className: "nextra-nav-container nx-sticky nx-top-0 nx-z-20 nx-w-full nx-bg-transparent print:nx-hidden", children: [
    /* @__PURE__ */ jsx18(
      "div",
      {
        className: cn11(
          "nextra-nav-container-blur",
          "nx-pointer-events-none nx-absolute nx-z-[-1] nx-h-full nx-w-full nx-bg-white dark:nx-bg-dark",
          "nx-shadow-[0_2px_4px_rgba(0,0,0,.02),0_1px_0_rgba(0,0,0,.06)] dark:nx-shadow-[0_-1px_0_rgba(255,255,255,.1)_inset]",
          "contrast-more:nx-shadow-[0_0_0_1px_#000] contrast-more:dark:nx-shadow-[0_0_0_1px_#fff]"
        )
      }
    ),
    /* @__PURE__ */ jsxs13("nav", { className: "nx-mx-auto nx-flex nx-h-[var(--nextra-navbar-height)] nx-max-w-[90rem] nx-items-center nx-justify-end nx-gap-2 nx-pl-[max(env(safe-area-inset-left),1.5rem)] nx-pr-[max(env(safe-area-inset-right),1.5rem)]", children: [
      config.logoLink ? /* @__PURE__ */ jsx18(
        Anchor,
        {
          href: typeof config.logoLink === "string" ? config.logoLink : "/",
          className: "nx-flex nx-items-center hover:nx-opacity-75 ltr:nx-mr-auto rtl:nx-ml-auto",
          children: renderComponent(config.logo)
        }
      ) : /* @__PURE__ */ jsx18("div", { className: "nx-flex nx-items-center ltr:nx-mr-auto rtl:nx-ml-auto", children: renderComponent(config.logo) }),
      items.map((pageOrMenu) => {
        if (pageOrMenu.display === "hidden") return null;
        if (pageOrMenu.type === "menu") {
          const menu2 = pageOrMenu;
          return /* @__PURE__ */ jsxs13(
            NavbarMenu,
            {
              className: cn11(
                classes2.link,
                "nx-flex nx-gap-1",
                classes2.inactive
              ),
              menu: menu2,
              children: [
                menu2.title,
                /* @__PURE__ */ jsx18(
                  ArrowRightIcon3,
                  {
                    className: "nx-h-[18px] nx-min-w-[18px] nx-rounded-sm nx-p-0.5",
                    pathClassName: "nx-origin-center nx-transition-transform nx-rotate-90"
                  }
                )
              ]
            },
            menu2.title
          );
        }
        const page = pageOrMenu;
        let href = page.href || page.route || "#";
        if (page.children) {
          href = (page.withIndexPage ? page.route : page.firstChildRoute) || href;
        }
        const isActive = page.route === activeRoute || activeRoute.startsWith(page.route + "/");
        return /* @__PURE__ */ jsxs13(
          Anchor,
          {
            href,
            className: cn11(
              classes2.link,
              "nx-relative -nx-ml-2 nx-hidden nx-whitespace-nowrap nx-p-2 md:nx-inline-block",
              !isActive || page.newWindow ? classes2.inactive : classes2.active
            ),
            newWindow: page.newWindow,
            "aria-current": !page.newWindow && isActive,
            children: [
              /* @__PURE__ */ jsx18("span", { className: "nx-absolute nx-inset-x-0 nx-text-center", children: page.title }),
              /* @__PURE__ */ jsx18("span", { className: "nx-invisible nx-font-medium", children: page.title })
            ]
          },
          href
        );
      }),
      renderComponent(config.search.component, {
        directories: flatDirectories,
        className: "nx-hidden md:nx-inline-block mx-min-w-[200px]"
      }),
      config.project.link ? /* @__PURE__ */ jsx18(
        Anchor,
        {
          className: "nx-p-2 nx-text-current",
          href: config.project.link,
          newWindow: true,
          children: renderComponent(config.project.icon)
        }
      ) : null,
      config.chat.link ? /* @__PURE__ */ jsx18(
        Anchor,
        {
          className: "nx-p-2 nx-text-current",
          href: config.chat.link,
          newWindow: true,
          children: renderComponent(config.chat.icon)
        }
      ) : null,
      renderComponent(config.navbar.extraContent),
      /* @__PURE__ */ jsx18(
        "button",
        {
          type: "button",
          "aria-label": "Menu",
          className: "nextra-hamburger -nx-mr-2 nx-rounded nx-p-2 active:nx-bg-gray-400/20 md:nx-hidden",
          onClick: () => setMenu(!menu),
          children: /* @__PURE__ */ jsx18(MenuIcon, { className: cn11({ open: menu }) })
        }
      )
    ] })
  ] });
}

// src/components/404.tsx
import { useRouter as useRouter4 } from "next/router";
import { useMounted as useMounted4 } from "nextra/hooks";
import { jsx as jsx19 } from "react/jsx-runtime";
function NotFoundPage() {
  const config = useConfig();
  const mounted = useMounted4();
  const { asPath } = useRouter4();
  const { content, labels } = config.notFound;
  if (!content) {
    return null;
  }
  return /* @__PURE__ */ jsx19("p", { className: "nx-text-center", children: /* @__PURE__ */ jsx19(
    Anchor,
    {
      href: getGitIssueUrl({
        repository: config.docsRepositoryBase,
        title: `Found broken \`${mounted ? asPath : ""}\` link. Please fix!`,
        labels
      }),
      newWindow: true,
      className: "nx-text-primary-600 nx-underline nx-decoration-from-font [text-underline-position:from-font]",
      children: renderComponent(content)
    }
  ) });
}

// src/components/500.tsx
import { useRouter as useRouter5 } from "next/router";
import { useMounted as useMounted5 } from "nextra/hooks";
import { jsx as jsx20 } from "react/jsx-runtime";
function ServerSideErrorPage() {
  const config = useConfig();
  const mounted = useMounted5();
  const { asPath } = useRouter5();
  const { content, labels } = config.serverSideError;
  if (!content) {
    return null;
  }
  return /* @__PURE__ */ jsx20("p", { className: "nx-text-center", children: /* @__PURE__ */ jsx20(
    Anchor,
    {
      href: getGitIssueUrl({
        repository: config.docsRepositoryBase,
        title: `Got server-side error in \`${mounted ? asPath : ""}\` url. Please fix!`,
        labels
      }),
      newWindow: true,
      className: "nx-text-primary-600 nx-underline nx-decoration-from-font [text-underline-position:from-font]",
      children: renderComponent(content)
    }
  ) });
}

// src/components/sidebar.tsx
import cn12 from "clsx";
import { useRouter as useRouter6 } from "next/router";
import { useFSRoute as useFSRoute2, useMounted as useMounted6 } from "nextra/hooks";
import { ArrowRightIcon as ArrowRightIcon4, ExpandIcon } from "nextra/icons";
import {
  createContext as createContext5,
  memo as memo2,
  useContext as useContext5,
  useEffect as useEffect4,
  useMemo as useMemo2,
  useRef as useRef5,
  useState as useState6
} from "react";
import scrollIntoView from "scroll-into-view-if-needed";
import { Fragment as Fragment8, jsx as jsx21, jsxs as jsxs14 } from "react/jsx-runtime";
var TreeState = /* @__PURE__ */ Object.create(null);
var FocusedItemContext = createContext5(null);
var OnFocusItemContext = createContext5(
  null
);
var FolderLevelContext = createContext5(0);
var Folder = memo2(function FolderInner(props) {
  const level = useContext5(FolderLevelContext);
  return /* @__PURE__ */ jsx21(FolderLevelContext.Provider, { value: level + 1, children: /* @__PURE__ */ jsx21(FolderImpl, __spreadValues({}, props)) });
});
var classes3 = {
  link: cn12(
    "nx-flex nx-rounded nx-px-2 nx-py-1.5 nx-text-sm nx-transition-colors [word-break:break-word]",
    "nx-cursor-pointer [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] contrast-more:nx-border"
  ),
  inactive: cn12(
    "nx-text-gray-500 hover:nx-bg-gray-100 hover:nx-text-gray-900",
    "dark:nx-text-neutral-400 dark:hover:nx-bg-primary-100/5 dark:hover:nx-text-gray-50",
    "contrast-more:nx-text-gray-900 contrast-more:dark:nx-text-gray-50",
    "contrast-more:nx-border-transparent contrast-more:hover:nx-border-gray-900 contrast-more:dark:hover:nx-border-gray-50"
  ),
  active: cn12(
    "nx-bg-primary-100 nx-font-semibold nx-text-primary-800 dark:nx-bg-primary-400/10 dark:nx-text-primary-600",
    "contrast-more:nx-border-primary-500 contrast-more:dark:nx-border-primary-500"
  ),
  list: cn12("nx-flex nx-flex-col nx-gap-1"),
  border: cn12(
    "nx-relative before:nx-absolute before:nx-inset-y-1",
    'before:nx-w-px before:nx-bg-gray-200 before:nx-content-[""] dark:before:nx-bg-neutral-800',
    "ltr:nx-pl-3 ltr:before:nx-left-0 rtl:nx-pr-3 rtl:before:nx-right-0"
  )
};
function FolderImpl({ item, anchors }) {
  const routeOriginal = useFSRoute2();
  const [route] = routeOriginal.split("#");
  const active = [route, route + "/"].includes(item.route + "/");
  const activeRouteInside = active || route.startsWith(item.route + "/");
  const focusedRoute = useContext5(FocusedItemContext);
  const focusedRouteInside = !!(focusedRoute == null ? void 0 : focusedRoute.startsWith(item.route + "/"));
  const level = useContext5(FolderLevelContext);
  const { setMenu } = useMenu();
  const config = useConfig();
  const { theme: theme2 } = item;
  const open = TreeState[item.route] === void 0 ? active || activeRouteInside || focusedRouteInside || (theme2 && "collapsed" in theme2 ? !theme2.collapsed : level < config.sidebar.defaultMenuCollapseLevel) : TreeState[item.route] || focusedRouteInside;
  const rerender = useState6({})[1];
  useEffect4(() => {
    const updateTreeState = () => {
      if (activeRouteInside || focusedRouteInside) {
        TreeState[item.route] = true;
      }
    };
    const updateAndPruneTreeState = () => {
      if (activeRouteInside && focusedRouteInside) {
        TreeState[item.route] = true;
      } else {
        delete TreeState[item.route];
      }
    };
    config.sidebar.autoCollapse ? updateAndPruneTreeState() : updateTreeState();
  }, [
    activeRouteInside,
    focusedRouteInside,
    item.route,
    config.sidebar.autoCollapse
  ]);
  if (item.type === "menu") {
    const menu = item;
    const routes = Object.fromEntries(
      (menu.children || []).map((route2) => [route2.name, route2])
    );
    item.children = Object.entries(menu.items || {}).map(([key, item2]) => {
      const route2 = routes[key] || __spreadProps(__spreadValues({
        name: key
      }, "locale" in menu && { locale: menu.locale }), {
        route: menu.route + "/" + key
      });
      return __spreadValues(__spreadValues({}, route2), item2);
    });
  }
  const isLink = "withIndexPage" in item && item.withIndexPage;
  const ComponentToUse = isLink ? Anchor : "button";
  return /* @__PURE__ */ jsxs14("li", { className: cn12({ open, active }), children: [
    /* @__PURE__ */ jsxs14(
      ComponentToUse,
      {
        href: isLink ? item.route : void 0,
        className: cn12(
          "nx-items-center nx-justify-between nx-gap-2",
          !isLink && "nx-text-left nx-w-full",
          classes3.link,
          active ? classes3.active : classes3.inactive
        ),
        onClick: (e) => {
          const clickedToggleIcon = ["svg", "path"].includes(
            e.target.tagName.toLowerCase()
          );
          if (clickedToggleIcon) {
            e.preventDefault();
          }
          if (isLink) {
            if (active || clickedToggleIcon) {
              TreeState[item.route] = !open;
            } else {
              TreeState[item.route] = true;
              setMenu(false);
            }
            rerender({});
            return;
          }
          if (active) return;
          TreeState[item.route] = !open;
          rerender({});
        },
        children: [
          renderComponent(config.sidebar.titleComponent, {
            title: item.title,
            type: item.type,
            route: item.route
          }),
          /* @__PURE__ */ jsx21(
            ArrowRightIcon4,
            {
              className: "nx-h-[18px] nx-min-w-[18px] nx-rounded-sm nx-p-0.5 hover:nx-bg-gray-800/5 dark:hover:nx-bg-gray-100/5",
              pathClassName: cn12(
                "nx-origin-center nx-transition-transform rtl:-nx-rotate-180",
                open && "ltr:nx-rotate-90 rtl:nx-rotate-[-270deg]"
              )
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx21(Collapse, { className: "ltr:nx-pr-0 rtl:nx-pl-0 nx-pt-1", isOpen: open, children: Array.isArray(item.children) ? /* @__PURE__ */ jsx21(
      Menu2,
      {
        className: cn12(classes3.border, "ltr:nx-ml-3 rtl:nx-mr-3"),
        directories: item.children,
        base: item.route,
        anchors
      }
    ) : null })
  ] });
}
function Separator({ title }) {
  const config = useConfig();
  return /* @__PURE__ */ jsx21(
    "li",
    {
      className: cn12(
        "[word-break:break-word]",
        title ? "nx-mt-5 nx-mb-2 nx-px-2 nx-py-1.5 nx-text-sm nx-font-semibold nx-text-gray-900 first:nx-mt-0 dark:nx-text-gray-100" : "nx-my-4"
      ),
      children: title ? renderComponent(config.sidebar.titleComponent, {
        title,
        type: "separator",
        route: ""
      }) : /* @__PURE__ */ jsx21("hr", { className: "nx-mx-2 nx-border-t nx-border-gray-200 dark:nx-border-primary-100/10" })
    }
  );
}
function File({
  item,
  anchors
}) {
  const route = useFSRoute2();
  const onFocus = useContext5(OnFocusItemContext);
  const active = item.route && [route, route + "/"].includes(item.route + "/");
  const activeAnchor = useActiveAnchor();
  const { setMenu } = useMenu();
  const config = useConfig();
  if (item.type === "separator") {
    return /* @__PURE__ */ jsx21(Separator, { title: item.title });
  }
  return /* @__PURE__ */ jsxs14("li", { className: cn12(classes3.list, { active }), children: [
    /* @__PURE__ */ jsx21(
      Anchor,
      {
        href: item.href || item.route,
        newWindow: item.newWindow,
        className: cn12(classes3.link, active ? classes3.active : classes3.inactive),
        onClick: () => {
          setMenu(false);
        },
        onFocus: () => {
          onFocus == null ? void 0 : onFocus(item.route);
        },
        onBlur: () => {
          onFocus == null ? void 0 : onFocus(null);
        },
        children: renderComponent(config.sidebar.titleComponent, {
          title: item.title,
          type: item.type,
          route: item.route
        })
      }
    ),
    active && anchors.length > 0 && /* @__PURE__ */ jsx21(
      "ul",
      {
        className: cn12(
          classes3.list,
          classes3.border,
          "ltr:nx-ml-3 rtl:nx-mr-3"
        ),
        children: anchors.map(({ id, value }) => {
          var _a;
          return /* @__PURE__ */ jsx21("li", { children: /* @__PURE__ */ jsx21(
            "a",
            {
              href: `#${id}`,
              className: cn12(
                classes3.link,
                'nx-flex nx-gap-2 before:nx-opacity-25 before:nx-content-["#"]',
                ((_a = activeAnchor[id]) == null ? void 0 : _a.isActive) ? classes3.active : classes3.inactive
              ),
              onClick: () => {
                setMenu(false);
              },
              children: value
            }
          ) }, id);
        })
      }
    )
  ] });
}
function Menu2({
  directories,
  anchors,
  className,
  onlyCurrentDocs
}) {
  return /* @__PURE__ */ jsx21("ul", { className: cn12(classes3.list, className), children: directories.map(
    (item) => !onlyCurrentDocs || item.isUnderCurrentDocsTree ? item.type === "menu" || item.children && (item.children.length || !item.withIndexPage) ? /* @__PURE__ */ jsx21(Folder, { item, anchors }, item.name) : /* @__PURE__ */ jsx21(File, { item, anchors }, item.name) : null
  ) });
}
function Sidebar({
  docsDirectories,
  flatDirectories,
  fullDirectories,
  asPopover = false,
  headings,
  includePlaceholder
}) {
  const config = useConfig();
  const { menu, setMenu } = useMenu();
  const router = useRouter6();
  const [focused, setFocused] = useState6(null);
  const [showSidebar, setSidebar] = useState6(false);
  const [showToggleAnimation, setToggleAnimation] = useState6(false);
  const anchors = useMemo2(() => headings.filter((v) => v.depth === 2), [headings]);
  const sidebarRef = useRef5(null);
  const containerRef = useRef5(null);
  const mounted = useMounted6();
  useEffect4(() => {
    if (menu) {
      document.body.classList.add("nx-overflow-hidden", "md:nx-overflow-auto");
    } else {
      document.body.classList.remove(
        "nx-overflow-hidden",
        "md:nx-overflow-auto"
      );
    }
  }, [menu]);
  useEffect4(() => {
    var _a;
    const activeElement = (_a = sidebarRef.current) == null ? void 0 : _a.querySelector("li.active");
    if (activeElement && (window.innerWidth > 767 || menu)) {
      const scroll = () => {
        scrollIntoView(activeElement, {
          block: "center",
          inline: "center",
          scrollMode: "always",
          boundary: containerRef.current
        });
      };
      if (menu) {
        setTimeout(scroll, 300);
      } else {
        scroll();
      }
    }
  }, [menu]);
  useEffect4(() => {
    setMenu(false);
  }, [router.asPath, setMenu]);
  const hasI18n = config.i18n.length > 0;
  const hasMenu = config.darkMode || hasI18n || config.sidebar.toggleButton;
  return /* @__PURE__ */ jsxs14(Fragment8, { children: [
    includePlaceholder && asPopover ? /* @__PURE__ */ jsx21("div", { className: "max-xl:nx-hidden nx-h-0 nx-w-64 nx-shrink-0" }) : null,
    /* @__PURE__ */ jsx21(
      "div",
      {
        className: cn12(
          "motion-reduce:nx-transition-none [transition:background-color_1.5s_ease]",
          menu ? "nx-fixed nx-inset-0 nx-z-10 nx-bg-black/80 dark:nx-bg-black/60" : "nx-bg-transparent"
        ),
        onClick: () => setMenu(false)
      }
    ),
    /* @__PURE__ */ jsxs14(
      "aside",
      {
        className: cn12(
          "nextra-sidebar-container nx-flex nx-flex-col",
          "md:nx-top-16 md:nx-shrink-0 motion-reduce:nx-transform-none",
          "nx-transform-gpu nx-transition-all nx-ease-in-out",
          "print:nx-hidden",
          showSidebar ? "md:nx-w-64" : "md:nx-w-20",
          asPopover ? "md:nx-hidden" : "md:nx-sticky md:nx-self-start",
          menu ? "max-md:[transform:translate3d(0,0,0)]" : "max-md:[transform:translate3d(0,-100%,0)]"
        ),
        ref: containerRef,
        children: [
          /* @__PURE__ */ jsx21("div", { className: "nx-px-4 nx-pt-4 md:nx-hidden", children: renderComponent(config.search.component, {
            directories: flatDirectories
          }) }),
          /* @__PURE__ */ jsx21(FocusedItemContext.Provider, { value: focused, children: /* @__PURE__ */ jsx21(
            OnFocusItemContext.Provider,
            {
              value: (item) => {
                setFocused(item);
              },
              children: /* @__PURE__ */ jsxs14(
                "div",
                {
                  className: cn12(
                    "nx-overflow-y-auto nx-overflow-x-hidden",
                    "nx-p-4 nx-grow md:nx-h-[calc(100vh-var(--nextra-navbar-height)-var(--nextra-menu-height))]",
                    showSidebar ? "nextra-scrollbar" : "no-scrollbar"
                  ),
                  style: { padding: "0.2rem" },
                  ref: sidebarRef,
                  children: [
                    (!asPopover || !showSidebar) && /* @__PURE__ */ jsx21(Collapse, { isOpen: showSidebar, horizontal: true, children: /* @__PURE__ */ jsx21(
                      Menu2,
                      {
                        className: "nextra-menu-desktop max-md:nx-hidden",
                        directories: docsDirectories,
                        anchors: config.toc.float ? [] : anchors,
                        onlyCurrentDocs: true
                      }
                    ) }),
                    mounted && window.innerWidth < 768 && /* @__PURE__ */ jsx21(
                      Menu2,
                      {
                        className: "nextra-menu-mobile md:nx-hidden",
                        directories: fullDirectories,
                        anchors
                      }
                    )
                  ]
                }
              )
            }
          ) }),
          hasMenu && /* @__PURE__ */ jsxs14(
            "div",
            {
              className: cn12(
                "nx-sticky nx-bottom-0",
                "nx-bg-white dark:nx-bg-dark",
                // when banner is showed, sidebar links can be behind menu, set bg color as body bg color
                "nx-mx-4 nx-py-4 nx-shadow-[0_-12px_16px_#fff]",
                "nx-flex nx-items-center nx-gap-2",
                "dark:nx-border-neutral-800 dark:nx-shadow-[0_-12px_16px_#111]",
                "contrast-more:nx-border-neutral-400 contrast-more:nx-shadow-none contrast-more:dark:nx-shadow-none",
                showSidebar ? cn12(hasI18n && "nx-justify-end", "nx-border-t") : "nx-py-4 nx-flex-wrap nx-justify-center"
              ),
              "data-toggle-animation": showToggleAnimation ? showSidebar ? "show" : "hide" : "off",
              children: [
                /* @__PURE__ */ jsx21(
                  LocaleSwitch,
                  {
                    lite: !showSidebar,
                    className: cn12(showSidebar ? "nx-grow" : "max-md:nx-grow")
                  }
                ),
                config.darkMode && /* @__PURE__ */ jsx21(
                  "div",
                  {
                    className: showSidebar && !hasI18n ? "nx-grow nx-flex nx-flex-col" : "",
                    children: renderComponent(config.themeSwitch.component, {
                      lite: !showSidebar || hasI18n
                    })
                  }
                ),
                config.sidebar.toggleButton && /* @__PURE__ */ jsx21(
                  "button",
                  {
                    title: showSidebar ? "Hide sidebar" : "Show sidebar",
                    className: "max-md:nx-hidden nx-h-7 nx-rounded-md nx-transition-colors nx-text-gray-600 dark:nx-text-gray-400 nx-px-2 hover:nx-bg-gray-100 hover:nx-text-gray-900 dark:hover:nx-bg-primary-100/5 dark:hover:nx-text-gray-50",
                    onClick: () => {
                      setSidebar(!showSidebar);
                      setToggleAnimation(true);
                    },
                    children: /* @__PURE__ */ jsx21(ExpandIcon, { isOpen: showSidebar })
                  }
                )
              ]
            }
          )
        ]
      }
    )
  ] });
}

// src/components/skip-nav.tsx
import cn13 from "clsx";
import { forwardRef as forwardRef3 } from "react";
import { jsx as jsx22 } from "react/jsx-runtime";
var DEFAULT_ID = "reach-skip-nav";
var DEFAULT_LABEL = "Skip to content";
var SkipNavLink = forwardRef3(
  function(_a, forwardedRef) {
    var _b = _a, {
      className: providedClassName,
      id,
      label = DEFAULT_LABEL,
      styled
    } = _b, props = __objRest(_b, [
      "className",
      "id",
      "label",
      "styled"
    ]);
    const className = providedClassName === void 0 ? styled ? cn13(
      "nx-sr-only",
      "focus:nx-not-sr-only focus:nx-fixed focus:nx-z-50 focus:nx-m-3 focus:nx-ml-4 focus:nx-h-[calc(var(--nextra-navbar-height)-1.5rem)] focus:nx-rounded-lg focus:nx-border focus:nx-px-3 focus:nx-py-2 focus:nx-align-middle focus:nx-text-sm focus:nx-font-bold",
      "focus:nx-text-gray-900 focus:dark:nx-text-gray-100",
      "focus:nx-bg-white focus:dark:nx-bg-neutral-900",
      "focus:nx-border-neutral-400 focus:dark:nx-border-neutral-800"
    ) : "" : providedClassName;
    return /* @__PURE__ */ jsx22(
      "a",
      __spreadProps(__spreadValues({}, props), {
        ref: forwardedRef,
        href: `#${id || DEFAULT_ID}`,
        className,
        "data-reach-skip-link": "",
        children: label
      })
    );
  }
);
SkipNavLink.displayName = "SkipNavLink";
var SkipNavContent = forwardRef3(
  function(_a, forwardedRef) {
    var _b = _a, { id } = _b, props = __objRest(_b, ["id"]);
    return /* @__PURE__ */ jsx22("div", __spreadProps(__spreadValues({}, props), { ref: forwardedRef, id: id || DEFAULT_ID }));
  }
);
SkipNavContent.displayName = "SkipNavContent";

// src/components/theme-switch.tsx
import { useTheme as useTheme2 } from "next-themes";
import { useMounted as useMounted7 } from "nextra/hooks";
import { MoonIcon, SunIcon } from "nextra/icons";
import { z } from "zod";
import { jsx as jsx23, jsxs as jsxs15 } from "react/jsx-runtime";
var themeOptionsSchema = z.strictObject({
  light: z.string(),
  dark: z.string(),
  system: z.string()
});
function ThemeSwitch({
  lite,
  className
}) {
  const { setTheme, resolvedTheme, theme: theme2 = "" } = useTheme2();
  const mounted = useMounted7();
  const config = useConfig().themeSwitch;
  const IconToUse = mounted && resolvedTheme === "dark" ? MoonIcon : SunIcon;
  const options = typeof config.useOptions === "function" ? config.useOptions() : config.useOptions;
  return /* @__PURE__ */ jsx23(
    Select,
    {
      className,
      title: "Change theme",
      options: [
        { key: "light", name: options.light },
        { key: "dark", name: options.dark },
        { key: "system", name: options.system }
      ],
      onChange: (option) => {
        setTheme(option.key);
      },
      selected: {
        key: theme2,
        name: /* @__PURE__ */ jsxs15("div", { className: "nx-flex nx-items-center nx-gap-2 nx-capitalize", children: [
          /* @__PURE__ */ jsx23(IconToUse, {}),
          /* @__PURE__ */ jsx23("span", { className: lite ? "md:nx-hidden" : "", children: mounted ? options[theme2] : options.light })
        ] })
      }
    }
  );
}

// src/components/toc.tsx
import cn15 from "clsx";
import { useEffect as useEffect6, useMemo as useMemo3, useRef as useRef7 } from "react";
import scrollIntoView2 from "scroll-into-view-if-needed";

// src/components/back-to-top.tsx
import cn14 from "clsx";
import { ArrowRightIcon as ArrowRightIcon5 } from "nextra/icons";
import { useEffect as useEffect5, useRef as useRef6 } from "react";
import { jsx as jsx24, jsxs as jsxs16 } from "react/jsx-runtime";
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function BackToTop({ className }) {
  const ref = useRef6(null);
  useEffect5(() => {
    function toggleVisible() {
      var _a;
      const { scrollTop } = document.documentElement;
      (_a = ref.current) == null ? void 0 : _a.classList.toggle("nx-opacity-0", scrollTop < 300);
    }
    window.addEventListener("scroll", toggleVisible);
    return () => {
      window.removeEventListener("scroll", toggleVisible);
    };
  }, []);
  return /* @__PURE__ */ jsxs16(
    "button",
    {
      ref,
      "aria-hidden": "true",
      onClick: scrollToTop,
      className: cn14(
        "nx-flex nx-items-center nx-gap-1.5 nx-transition nx-opacity-0",
        className
      ),
      children: [
        "Scroll to top",
        /* @__PURE__ */ jsx24(ArrowRightIcon5, { className: "-nx-rotate-90 nx-w-3.5 nx-h-3.5 nx-border nx-rounded-full nx-border-current" })
      ]
    }
  );
}

// src/components/toc.tsx
import { Fragment as Fragment9, jsx as jsx25, jsxs as jsxs17 } from "react/jsx-runtime";
var linkClassName = cn15(
  "nx-text-xs nx-font-medium nx-text-gray-500 hover:nx-text-gray-900 dark:nx-text-gray-400 dark:hover:nx-text-gray-100",
  "contrast-more:nx-text-gray-800 contrast-more:dark:nx-text-gray-50"
);
function TOC({ headings, filePath }) {
  var _a;
  const activeAnchor = useActiveAnchor();
  const config = useConfig();
  const tocRef = useRef7(null);
  const items = useMemo3(
    () => headings.filter((heading) => heading.depth > 1),
    [headings]
  );
  const hasHeadings = items.length > 0;
  const hasMetaInfo = Boolean(
    config.feedback.content || config.editLink.component || config.toc.extraContent
  );
  const activeSlug = (_a = Object.entries(activeAnchor).find(
    ([, { isActive }]) => isActive
  )) == null ? void 0 : _a[0];
  useEffect6(() => {
    var _a2;
    if (!activeSlug) return;
    const anchor = (_a2 = tocRef.current) == null ? void 0 : _a2.querySelector(
      `li > a[href="#${activeSlug}"]`
    );
    if (anchor) {
      scrollIntoView2(anchor, {
        behavior: "smooth",
        block: "center",
        inline: "center",
        scrollMode: "always",
        boundary: tocRef.current
      });
    }
  }, [activeSlug]);
  return /* @__PURE__ */ jsxs17(
    "div",
    {
      ref: tocRef,
      className: cn15(
        "nextra-scrollbar nx-sticky nx-top-16 nx-overflow-y-auto nx-pr-4 nx-pt-6 nx-text-sm [hyphens:auto]",
        "nx-max-h-[calc(100vh-var(--nextra-navbar-height)-env(safe-area-inset-bottom))] ltr:-nx-mr-4 rtl:-nx-ml-4"
      ),
      children: [
        hasHeadings && /* @__PURE__ */ jsxs17(Fragment9, { children: [
          /* @__PURE__ */ jsx25("p", { className: "nx-mb-4 nx-font-semibold nx-tracking-tight", children: renderComponent(config.toc.title) }),
          /* @__PURE__ */ jsx25("ul", { children: items.map(({ id, value, depth }) => {
            var _a2, _b, _c, _d;
            return /* @__PURE__ */ jsx25("li", { className: "nx-my-2 nx-scroll-my-6 nx-scroll-py-6", children: /* @__PURE__ */ jsx25(
              "a",
              {
                href: `#${id}`,
                className: cn15(
                  {
                    2: "nx-font-semibold",
                    3: "ltr:nx-pl-4 rtl:nx-pr-4",
                    4: "ltr:nx-pl-8 rtl:nx-pr-8",
                    5: "ltr:nx-pl-12 rtl:nx-pr-12",
                    6: "ltr:nx-pl-16 rtl:nx-pr-16"
                  }[depth],
                  "nx-inline-block",
                  ((_a2 = activeAnchor[id]) == null ? void 0 : _a2.isActive) ? "nx-text-primary-600 nx-subpixel-antialiased contrast-more:!nx-text-primary-600" : "nx-text-gray-500 hover:nx-text-gray-900 dark:nx-text-gray-400 dark:hover:nx-text-gray-300",
                  "contrast-more:nx-text-gray-900 contrast-more:nx-underline contrast-more:dark:nx-text-gray-50 nx-w-full nx-break-words"
                ),
                children: (_d = (_c = (_b = config.toc).headingComponent) == null ? void 0 : _c.call(_b, {
                  id,
                  children: value
                })) != null ? _d : value
              }
            ) }, id);
          }) })
        ] }),
        hasMetaInfo && /* @__PURE__ */ jsxs17(
          "div",
          {
            className: cn15(
              hasHeadings && "nx-mt-8 nx-border-t nx-bg-white nx-pt-8 nx-shadow-[0_-12px_16px_white] dark:nx-bg-dark dark:nx-shadow-[0_-12px_16px_#111]",
              "nx-sticky nx-bottom-0 nx-flex nx-flex-col nx-items-start nx-gap-2 nx-pb-8 dark:nx-border-neutral-800",
              "contrast-more:nx-border-t contrast-more:nx-border-neutral-400 contrast-more:nx-shadow-none contrast-more:dark:nx-border-neutral-400"
            ),
            children: [
              config.feedback.content ? /* @__PURE__ */ jsx25(
                Anchor,
                {
                  className: linkClassName,
                  href: config.feedback.useLink(),
                  newWindow: true,
                  children: renderComponent(config.feedback.content)
                }
              ) : null,
              renderComponent(config.editLink.component, {
                filePath,
                className: linkClassName,
                children: renderComponent(config.editLink.text)
              }),
              renderComponent(config.toc.extraContent),
              config.toc.backToTop && /* @__PURE__ */ jsx25(BackToTop, { className: linkClassName })
            ]
          }
        )
      ]
    }
  );
}

// src/components/match-sorter-search.tsx
import { matchSorter } from "match-sorter";
import { useMemo as useMemo4, useState as useState7 } from "react";
import { jsx as jsx26 } from "react/jsx-runtime";
function MatchSorterSearch({
  className,
  directories
}) {
  const [search, setSearch] = useState7("");
  const results = useMemo4(
    () => (
      // Will need to scrape all the headers from each page and search through them here
      // (similar to what we already do to render the hash links in sidebar)
      // We could also try to search the entire string text from each page
      search ? matchSorter(directories, search, { keys: ["title"] }).map(
        ({ route, title }) => ({
          id: route + title,
          route,
          children: /* @__PURE__ */ jsx26(HighlightMatches, { value: title, match: search })
        })
      ) : []
    ),
    [search, directories]
  );
  return /* @__PURE__ */ jsx26(
    Search,
    {
      value: search,
      onChange: setSearch,
      className,
      overlayClassName: "nx-w-full",
      results
    }
  );
}

// src/constants.tsx
import { Fragment as Fragment10, jsx as jsx27, jsxs as jsxs18 } from "react/jsx-runtime";
var DEFAULT_LOCALE = "en-US";
var IS_BROWSER = typeof window !== "undefined";
function isReactNode(value) {
  return value == null || typeof value === "string" || isFunction(value) || isValidElement(value);
}
function isFunction(value) {
  return typeof value === "function";
}
var i18nSchema = z2.array(
  z2.strictObject({
    direction: z2.enum(["ltr", "rtl"]).optional(),
    locale: z2.string(),
    text: z2.string()
  })
);
var reactNode = [
  isReactNode,
  { message: "Must be React.ReactNode or React.FC" }
];
var fc = [isFunction, { message: "Must be React.FC" }];
var themeSchema = z2.strictObject({
  banner: z2.strictObject({
    dismissible: z2.boolean(),
    key: z2.string(),
    text: z2.custom(...reactNode).optional()
  }),
  chat: z2.strictObject({
    icon: z2.custom(...reactNode),
    link: z2.string().startsWith("https://").optional()
  }),
  components: z2.record(z2.custom(...fc)).optional(),
  darkMode: z2.boolean(),
  direction: z2.enum(["ltr", "rtl"]),
  docsRepositoryBase: z2.string().startsWith("https://"),
  editLink: z2.strictObject({
    component: z2.custom(...fc).or(z2.null()),
    text: z2.custom(...reactNode)
  }),
  faviconGlyph: z2.string().optional(),
  feedback: z2.strictObject({
    content: z2.custom(...reactNode),
    labels: z2.string(),
    useLink: z2.function().returns(z2.string())
  }),
  footer: z2.strictObject({
    component: z2.custom(...reactNode),
    text: z2.custom(...reactNode)
  }),
  gitTimestamp: z2.custom(...reactNode),
  head: z2.custom(...reactNode),
  i18n: i18nSchema,
  logo: z2.custom(...reactNode),
  logoLink: z2.boolean().or(z2.string()),
  main: z2.custom(...fc).optional(),
  navbar: z2.strictObject({
    component: z2.custom(...reactNode),
    extraContent: z2.custom(...reactNode).optional()
  }),
  navigation: z2.boolean().or(
    z2.strictObject({
      next: z2.boolean(),
      prev: z2.boolean()
    })
  ),
  nextThemes: z2.strictObject({
    defaultTheme: z2.string(),
    forcedTheme: z2.string().optional(),
    storageKey: z2.string()
  }),
  notFound: z2.strictObject({
    content: z2.custom(...reactNode),
    labels: z2.string()
  }),
  primaryHue: z2.number().or(
    z2.strictObject({
      dark: z2.number(),
      light: z2.number()
    })
  ),
  primarySaturation: z2.number().or(
    z2.strictObject({
      dark: z2.number(),
      light: z2.number()
    })
  ),
  project: z2.strictObject({
    icon: z2.custom(...reactNode),
    link: z2.string().startsWith("https://").optional()
  }),
  search: z2.strictObject({
    component: z2.custom(...reactNode),
    emptyResult: z2.custom(...reactNode),
    error: z2.string().or(z2.function().returns(z2.string())),
    loading: z2.custom(...reactNode),
    // Can't be React component
    placeholder: z2.string().or(z2.function().returns(z2.string()))
  }),
  serverSideError: z2.strictObject({
    content: z2.custom(...reactNode),
    labels: z2.string()
  }),
  sidebar: z2.strictObject({
    autoCollapse: z2.boolean().optional(),
    defaultMenuCollapseLevel: z2.number().min(1).int(),
    titleComponent: z2.custom(...reactNode),
    toggleButton: z2.boolean()
  }),
  themeSwitch: z2.strictObject({
    component: z2.custom(
      ...reactNode
    ),
    useOptions: themeOptionsSchema.or(z2.function().returns(themeOptionsSchema))
  }),
  toc: z2.strictObject({
    backToTop: z2.boolean(),
    component: z2.custom(...reactNode),
    extraContent: z2.custom(...reactNode),
    float: z2.boolean(),
    headingComponent: z2.custom(...fc).optional(),
    title: z2.custom(...reactNode)
  }),
  useNextSeoProps: z2.custom(isFunction)
});
var publicThemeSchema = themeSchema.deepPartial().extend({
  // to have `locale` and `text` as required properties
  i18n: i18nSchema.optional()
});
var LOADING_LOCALES = {
  "en-US": "Loading",
  fr: "\u0421hargement",
  ru: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430",
  "zh-CN": "\u6B63\u5728\u52A0\u8F7D"
};
var PLACEHOLDER_LOCALES = {
  "en-US": "Search documentation",
  fr: "Rechercher documents",
  ru: "\u041F\u043E\u0438\u0441\u043A \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438",
  "zh-CN": "\u641C\u7D22\u6587\u6863"
};
var DEFAULT_THEME = {
  banner: {
    dismissible: true,
    key: "nextra-banner"
  },
  chat: {
    icon: /* @__PURE__ */ jsxs18(Fragment10, { children: [
      /* @__PURE__ */ jsx27(DiscordIcon, {}),
      /* @__PURE__ */ jsx27("span", { className: "nx-sr-only", children: "Discord" })
    ] })
  },
  darkMode: true,
  direction: "ltr",
  docsRepositoryBase: "https://github.com/shuding/nextra",
  editLink: {
    component: function EditLink({ className, filePath, children }) {
      const editUrl = useGitEditUrl(filePath);
      if (!editUrl) {
        return null;
      }
      return /* @__PURE__ */ jsx27(Anchor, { className, href: editUrl, children });
    },
    text: "Edit this page"
  },
  feedback: {
    content: "Question? Give us feedback \u2192",
    labels: "feedback",
    useLink() {
      const config = useConfig();
      return getGitIssueUrl({
        labels: config.feedback.labels,
        repository: config.docsRepositoryBase,
        title: `Feedback for \u201C${config.title}\u201D`
      });
    }
  },
  footer: {
    component: Footer,
    text: `MIT ${(/* @__PURE__ */ new Date()).getFullYear()} \xA9 Nextra.`
  },
  gitTimestamp: function GitTimestamp({ timestamp }) {
    const { locale = DEFAULT_LOCALE } = useRouter7();
    return /* @__PURE__ */ jsxs18(Fragment10, { children: [
      "Last updated on",
      " ",
      /* @__PURE__ */ jsx27("time", { dateTime: timestamp.toISOString(), children: timestamp.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) })
    ] });
  },
  head: /* @__PURE__ */ jsxs18(Fragment10, { children: [
    /* @__PURE__ */ jsx27("meta", { name: "msapplication-TileColor", content: "#fff" }),
    /* @__PURE__ */ jsx27("meta", { httpEquiv: "Content-Language", content: "en" }),
    /* @__PURE__ */ jsx27("meta", { name: "description", content: "Nextra: the next docs builder" }),
    /* @__PURE__ */ jsx27("meta", { name: "twitter:card", content: "summary_large_image" }),
    /* @__PURE__ */ jsx27("meta", { name: "twitter:site", content: "@shuding_" }),
    /* @__PURE__ */ jsx27("meta", { property: "og:title", content: "Nextra: the next docs builder" }),
    /* @__PURE__ */ jsx27("meta", { property: "og:description", content: "Nextra: the next docs builder" }),
    /* @__PURE__ */ jsx27("meta", { name: "apple-mobile-web-app-title", content: "Nextra" })
  ] }),
  i18n: [],
  logo: /* @__PURE__ */ jsxs18(Fragment10, { children: [
    /* @__PURE__ */ jsx27("span", { className: "nx-font-extrabold", children: "Nextra" }),
    /* @__PURE__ */ jsx27("span", { className: "nx-ml-2 nx-hidden nx-font-normal nx-text-gray-600 md:nx-inline", children: "The Next Docs Builder" })
  ] }),
  logoLink: true,
  navbar: {
    component: Navbar
  },
  navigation: true,
  nextThemes: {
    defaultTheme: "system",
    storageKey: "theme"
  },
  notFound: {
    content: "Submit an issue about broken link \u2192",
    labels: "bug"
  },
  primaryHue: {
    dark: 204,
    light: 212
  },
  primarySaturation: {
    dark: 100,
    light: 100
  },
  project: {
    icon: /* @__PURE__ */ jsxs18(Fragment10, { children: [
      /* @__PURE__ */ jsx27(GitHubIcon, {}),
      /* @__PURE__ */ jsx27("span", { className: "nx-sr-only", children: "GitHub" })
    ] })
  },
  search: {
    component: function Search2({ className, directories }) {
      const config = useConfig();
      return config.flexsearch ? /* @__PURE__ */ jsx27(Flexsearch, { className }) : /* @__PURE__ */ jsx27(MatchSorterSearch, { className, directories });
    },
    emptyResult: /* @__PURE__ */ jsx27("span", { className: "nx-block nx-select-none nx-p-8 nx-text-center nx-text-sm nx-text-gray-400", children: "No results found." }),
    error: "Failed to load search index.",
    loading: function useLoading() {
      const { locale, defaultLocale = DEFAULT_LOCALE } = useRouter7();
      const text = locale && LOADING_LOCALES[locale] || LOADING_LOCALES[defaultLocale];
      return /* @__PURE__ */ jsxs18(Fragment10, { children: [
        text,
        "\u2026"
      ] });
    },
    placeholder: function usePlaceholder() {
      const { locale, defaultLocale = DEFAULT_LOCALE } = useRouter7();
      const text = locale && PLACEHOLDER_LOCALES[locale] || PLACEHOLDER_LOCALES[defaultLocale];
      return `${text}\u2026`;
    }
  },
  serverSideError: {
    content: "Submit an issue about error in url \u2192",
    labels: "bug"
  },
  sidebar: {
    defaultMenuCollapseLevel: 2,
    titleComponent: ({ title }) => /* @__PURE__ */ jsx27(Fragment10, { children: title }),
    toggleButton: false
  },
  themeSwitch: {
    component: ThemeSwitch,
    useOptions() {
      const { locale } = useRouter7();
      if (locale === "zh-CN") {
        return { dark: "\u6DF1\u8272\u4E3B\u9898", light: "\u6D45\u8272\u4E3B\u9898", system: "\u7CFB\u7EDF\u9ED8\u8BA4" };
      }
      return { dark: "Dark", light: "Light", system: "System" };
    }
  },
  toc: {
    backToTop: false,
    component: TOC,
    float: true,
    title: "On This Page"
  },
  useNextSeoProps: () => ({ titleTemplate: "%s \u2013 Nextra" })
};
var DEEP_OBJECT_KEYS = Object.entries(DEFAULT_THEME).map(([key, value]) => {
  const isObject = value && typeof value === "object" && !Array.isArray(value) && !isValidElement(value);
  if (isObject) {
    return key;
  }
}).filter(Boolean);

// src/polyfill.ts
if (IS_BROWSER) {
  let resizeTimer;
  const addResizingClass = () => {
    document.body.classList.add("resizing");
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.body.classList.remove("resizing");
    }, 200);
  };
  window.addEventListener("resize", addResizingClass);
}

// src/index.tsx
import { normalizePages } from "nextra/normalize-pages";
import Markdown from "markdown-to-jsx";

// src/mdx-components.tsx
import cn16 from "clsx";
import { Code, Pre, Table, Td, Th, Tr } from "nextra/components";
import { Children, cloneElement, useEffect as useEffect7, useRef as useRef8, useState as useState8 } from "react";
import { jsx as jsx28, jsxs as jsxs19 } from "react/jsx-runtime";
function HeadingLink(_a) {
  var _b = _a, {
    tag: Tag,
    context,
    children,
    id,
    className
  } = _b, props = __objRest(_b, [
    "tag",
    "context",
    "children",
    "id",
    "className"
  ]);
  const setActiveAnchor = useSetActiveAnchor();
  const slugs2 = useSlugs();
  const observer = useIntersectionObserver();
  const obRef = useRef8(null);
  useEffect7(() => {
    if (!id) return;
    const heading = obRef.current;
    if (!heading) return;
    slugs2.set(heading, [id, context.index += 1]);
    observer == null ? void 0 : observer.observe(heading);
    return () => {
      observer == null ? void 0 : observer.disconnect();
      slugs2.delete(heading);
      setActiveAnchor((f) => {
        const ret = __spreadValues({}, f);
        delete ret[id];
        return ret;
      });
    };
  }, [id, context, slugs2, observer, setActiveAnchor]);
  return /* @__PURE__ */ jsxs19(
    Tag,
    __spreadProps(__spreadValues({
      className: (
        // can be added by footnotes
        className === "sr-only" ? "nx-sr-only" : cn16(
          "nx-font-semibold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100",
          {
            h2: "nx-mt-10 nx-border-b nx-pb-1 nx-text-3xl nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400",
            h3: "nx-mt-8 nx-text-2xl",
            h4: "nx-mt-8 nx-text-xl",
            h5: "nx-mt-8 nx-text-lg",
            h6: "nx-mt-8 nx-text-base"
          }[Tag]
        )
      )
    }, props), {
      children: [
        children,
        id && /* @__PURE__ */ jsx28(
          "a",
          {
            href: `#${id}`,
            id,
            className: "subheading-anchor",
            "aria-label": "Permalink for this section",
            ref: obRef
          }
        )
      ]
    })
  );
}
var findSummary = (children) => {
  let summary = null;
  const restChildren = [];
  Children.forEach(children, (child, index) => {
    var _a;
    if (child && child.type === Summary) {
      summary || (summary = child);
      return;
    }
    let c = child;
    if (!summary && child && typeof child === "object" && child.type !== Details && "props" in child && child.props) {
      const result = findSummary(child.props.children);
      summary = result[0];
      c = cloneElement(child, __spreadProps(__spreadValues({}, child.props), {
        children: ((_a = result[1]) == null ? void 0 : _a.length) ? result[1] : void 0,
        key: index
      }));
    }
    restChildren.push(c);
  });
  return [summary, restChildren];
};
var Details = (_a) => {
  var _b = _a, {
    children,
    open
  } = _b, props = __objRest(_b, [
    "children",
    "open"
  ]);
  const [openState, setOpen] = useState8(!!open);
  const [summary, restChildren] = findSummary(children);
  const [delayedOpenState, setDelayedOpenState] = useState8(openState);
  useEffect7(() => {
    if (openState) {
      setDelayedOpenState(true);
    } else {
      const timeout = setTimeout(() => setDelayedOpenState(openState), 500);
      return () => clearTimeout(timeout);
    }
  }, [openState]);
  return /* @__PURE__ */ jsxs19(
    "details",
    __spreadProps(__spreadValues(__spreadProps(__spreadValues({
      className: "nx-my-4 nx-rounded nx-border nx-border-gray-200 nx-bg-white nx-p-2 nx-shadow-sm first:nx-mt-0 dark:nx-border-neutral-800 dark:nx-bg-neutral-900"
    }, props), {
      open: delayedOpenState
    }), openState && { "data-expanded": true }), {
      children: [
        /* @__PURE__ */ jsx28(DetailsProvider, { value: setOpen, children: summary }),
        /* @__PURE__ */ jsx28(Collapse, { isOpen: openState, children: restChildren })
      ]
    })
  );
};
var Summary = (props) => {
  const setOpen = useDetails();
  return /* @__PURE__ */ jsx28(
    "summary",
    __spreadProps(__spreadValues({
      className: cn16(
        "nx-flex nx-items-center nx-cursor-pointer nx-list-none nx-p-1 nx-transition-colors hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800",
        "before:nx-mr-1 before:nx-inline-block before:nx-transition-transform before:nx-content-[''] dark:before:nx-invert before:nx-shrink-0",
        "rtl:before:nx-rotate-180 [[data-expanded]>&]:before:nx-rotate-90"
      )
    }, props), {
      onClick: (e) => {
        e.preventDefault();
        setOpen((v) => !v);
      }
    })
  );
};
var EXTERNAL_HREF_REGEX = /https?:\/\//;
var Link = (_a) => {
  var _b = _a, { href = "", className } = _b, props = __objRest(_b, ["href", "className"]);
  return /* @__PURE__ */ jsx28(
    Anchor,
    __spreadValues({
      href,
      newWindow: EXTERNAL_HREF_REGEX.test(href),
      className: cn16(
        "nx-text-primary-600 nx-underline nx-decoration-from-font [text-underline-position:from-font]",
        className
      )
    }, props)
  );
};
var A = (_a) => {
  var _b = _a, { href = "" } = _b, props = __objRest(_b, ["href"]);
  return /* @__PURE__ */ jsx28(Anchor, __spreadValues({ href, newWindow: EXTERNAL_HREF_REGEX.test(href) }, props));
};
var getComponents = ({
  isRawLayout,
  components
}) => {
  if (isRawLayout) {
    return { a: A };
  }
  const context = { index: 0 };
  return __spreadValues({
    h1: (props) => /* @__PURE__ */ jsx28(
      "h1",
      __spreadValues({
        className: "nx-mt-2 nx-text-4xl nx-font-bold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100"
      }, props)
    ),
    h2: (props) => /* @__PURE__ */ jsx28(HeadingLink, __spreadValues({ tag: "h2", context }, props)),
    h3: (props) => /* @__PURE__ */ jsx28(HeadingLink, __spreadValues({ tag: "h3", context }, props)),
    h4: (props) => /* @__PURE__ */ jsx28(HeadingLink, __spreadValues({ tag: "h4", context }, props)),
    h5: (props) => /* @__PURE__ */ jsx28(HeadingLink, __spreadValues({ tag: "h5", context }, props)),
    h6: (props) => /* @__PURE__ */ jsx28(HeadingLink, __spreadValues({ tag: "h6", context }, props)),
    ul: (props) => /* @__PURE__ */ jsx28(
      "ul",
      __spreadValues({
        className: "nx-mt-6 nx-list-disc first:nx-mt-0 ltr:nx-ml-6 rtl:nx-mr-6"
      }, props)
    ),
    ol: (props) => /* @__PURE__ */ jsx28(
      "ol",
      __spreadValues({
        className: "nx-mt-6 nx-list-decimal first:nx-mt-0 ltr:nx-ml-6 rtl:nx-mr-6"
      }, props)
    ),
    li: (props) => /* @__PURE__ */ jsx28("li", __spreadValues({ className: "nx-my-2" }, props)),
    blockquote: (props) => /* @__PURE__ */ jsx28(
      "blockquote",
      __spreadValues({
        className: cn16(
          "nx-mt-6 nx-border-gray-300 nx-italic nx-text-gray-700 dark:nx-border-gray-700 dark:nx-text-gray-400",
          "first:nx-mt-0 ltr:nx-border-l-2 ltr:nx-pl-6 rtl:nx-border-r-2 rtl:nx-pr-6"
        )
      }, props)
    ),
    hr: (props) => /* @__PURE__ */ jsx28(
      "hr",
      __spreadValues({
        className: "nx-my-8 nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400"
      }, props)
    ),
    a: Link,
    table: (props) => /* @__PURE__ */ jsx28(
      Table,
      __spreadValues({
        className: "nextra-scrollbar nx-mt-6 nx-p-0 first:nx-mt-0"
      }, props)
    ),
    p: (props) => /* @__PURE__ */ jsx28("p", __spreadValues({ className: "nx-mt-6 nx-leading-7 first:nx-mt-0" }, props)),
    tr: Tr,
    th: Th,
    td: Td,
    details: Details,
    summary: Summary,
    pre: Pre,
    code: Code
  }, components);
};

// src/contexts/FrontMatterContext.tsx
import { createContext as createContext6, useContext as useContext6, useState as useState9, useEffect as useEffect8 } from "react";

// src/utils/api.ts
var fetchFrontMatter = () => __async(void 0, null, function* () {
  const response = yield fetch("/frontMatter.json");
  if (!response.ok) {
    throw new Error("Failed to fetch frontMatter");
  }
  return response.json();
});

// ../website/public/frontMatter.json
var frontMatter_default = {
  "an1.1-10.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.1.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#11",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.2.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#12",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.3.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#13",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.4.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#14",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.5.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#15",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.6.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#16",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.7.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#17",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.8.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#18",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.9.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#19",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.10.en": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.en#110",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an1.1-10.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.1.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#11",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.2.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#12",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.3.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#13",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.4.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#14",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.5.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#15",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.6.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#16",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.7.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#17",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.8.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#18",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.9.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#19",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.10.pli": {
    title: "Cittapariy\u0101d\u0101na vagga - The Chapter on the Obsession of the Mind",
    description: "The Buddha explains how the mind can be obsessed by the senses.",
    fetter: "sensual desire",
    tags: "mind, senses, man, woman, obsession, an, an1",
    id: "an1.1-10",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.1-10.pli#110",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.11-20.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.11.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#111",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.12.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#112",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.13.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#113",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.14.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#114",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.15.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#115",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.16.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#116",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.17.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#117",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.18.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#118",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.19.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#119",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.20.en": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.en#120",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.11-20.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.11.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#111",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.12.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#112",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.13.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#113",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.14.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#114",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.15.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#115",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.16.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#116",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.17.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#117",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.18.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#118",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.19.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#119",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.20.pli": {
    title: "N\u012Bvara\u1E47appah\u0101na vagga - The Chapter On The Abandoning Of The Hindrances",
    description: "The Buddha explains what causes the hindrances to arise and how to abandon them.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness and drowsiness, restlessness and worry, doubt, five hindrances, wise attention, unwise attention, an, an1",
    id: "an1.11-20",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.11-20.pli#120",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.140-149.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.140.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1140",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.141.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1141",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.142.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1142",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.143.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1143",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.144.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1144",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.145.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1145",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.146.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1146",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.147.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1147",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.148.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1148",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.149.en": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.en#1149",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.140-149.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.140.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1140",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.141.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1141",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.142.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1142",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.143.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1143",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.144.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1144",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.145.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1145",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.146.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1146",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.147.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1147",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.148.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1148",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.149.pli": {
    title: "Adhamma vagga - The Chapter On Not The Teaching",
    description: "The Buddha shares the importance of explaining correctly what is not the Dhamma, discipline, spoken or uttered, practiced, and prescribed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.140-149",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.140-149.pli#1149",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.21-30.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.21.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#121",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.22.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#122",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.23.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#123",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.24.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#124",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.25.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#125",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.26.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#126",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.27.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#127",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.28.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#128",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.29.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#129",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.30.en": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.en#130",
    updatedTime: "2024-09-09T17:23:58.000Z"
  },
  "an1.21-30.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.21.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#121",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.22.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#122",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.23.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#123",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.24.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#124",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.25.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#125",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.26.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#126",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.27.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#127",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.28.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#128",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.29.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#129",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.30.pli": {
    title: "Akammaniya vagga - The Chapter On The Ineffective",
    description: "The Buddha contrasts the undeveloped and developed mind.",
    fetter: "ignorance",
    tags: "mind, development, benefit, harm, ease, an, an1",
    id: "an1.21-30",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.21-30.pli#130",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.31-40.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.31.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#131",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.32.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#132",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.33.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#133",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.34.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#134",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.35.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#135",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.36.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#136",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.37.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#137",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.38.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#138",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.39.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#139",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.40.en": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.en#140",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.31-40.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.31.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#131",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.32.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#132",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.33.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#133",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.34.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#134",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.35.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#135",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.36.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#136",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.37.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#137",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.38.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#138",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.39.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#139",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.40.pli": {
    title: "Adanta vagga - The Chapter on the Untamed",
    description: "Short teachings contrasting the untamed and the tamed mind.",
    fetter: "ignorance",
    tags: "mind, harm, untamed, tamed, benefit, an, an1",
    id: "an1.31-40",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.31-40.pli#140",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.41-50.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.41.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#141",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.42.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#142",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.43.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#143",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.44.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#144",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.45.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#145",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.46.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#146",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.47.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#147",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.48.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#148",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.49.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#149",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.50.en": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.en#150",
    updatedTime: "2024-08-20T11:04:25.000Z"
  },
  "an1.41-50.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.41.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#141",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.42.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#142",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.43.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#143",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.44.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#144",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.45.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#145",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.46.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#146",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.47.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#147",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.48.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#148",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.49.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#149",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.50.pli": {
    title: "Pa\u1E47ihitaaccha vagga - The Chapter On Directing The Mind",
    description: "The Buddha contrasts the misdirected and well-directed mind, and explains the importance of directing the mind.",
    fetter: "ignorance",
    tags: "mind, direction, corruption, serenity, clarity, flexibility, change, radiance, defilements, an, an1",
    id: "an1.41-50",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.41-50.pli#150",
    updatedTime: "2024-08-13T09:06:57.000Z"
  },
  "an1.51-60.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.51.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#151",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.52.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#152",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.53.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#153",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.54.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#154",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.55.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#155",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.56.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#156",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.57.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#157",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.58.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#158",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.59.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#159",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.60.en": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.en#160",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.51-60.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.51.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#151",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.52.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#152",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.53.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#153",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.54.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#154",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.55.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#155",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.56.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#156",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.57.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#157",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.58.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#158",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.59.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#159",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.60.pli": {
    title: "Acchar\u0101sa\u1E45gh\u0101ta vagga - The Chapter On A Finger Snap",
    description: "The Buddha explains the importance of developing a radiant mind, a mind of loving-kindness and the consequences of negligence, heedfulness, and laziness.",
    fetter: "ignorance",
    tags: "mind, radiant, development, loving-kindness, heedfulness, negligence, laziness, wholesome, unwholesome, an, an1",
    id: "an1.51-60",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.51-60.pli#160",
    updatedTime: "2024-08-19T12:45:19.000Z"
  },
  "an1.575-615.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.575.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1575",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.576.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1576",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.577.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1577",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.578.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1578",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.579.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1579",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.580.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1580",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.581.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1581",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.582.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1582",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.583.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1583",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.584.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1584",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.585.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1585",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.586.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1586",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.587.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1587",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.588.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1588",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.589.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1589",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.590.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1590",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.591.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1591",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.592.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1592",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.593.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1593",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.594.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1594",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.595.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1595",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.596.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1596",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.597.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1597",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.598.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1598",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.599.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1599",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.600.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1600",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.601.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1601",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.602.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1602",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.603.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1603",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.604.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1604",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.605.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1605",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.606.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1606",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.607.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1607",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.608.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1608",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.609.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1609",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.610.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1610",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.611.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1611",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.612.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1612",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.613.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1613",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.614.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1614",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.615.en": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body.",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.en#1615",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "an1.575-615.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.575.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1575",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.576.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1576",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.577.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1577",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.578.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1578",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.579.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1579",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.580.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1580",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.581.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1581",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.582.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1582",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.583.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1583",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.584.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1584",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.585.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1585",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.586.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1586",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.587.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1587",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.588.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1588",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.589.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1589",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.590.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1590",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.591.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1591",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.592.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1592",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.593.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1593",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.594.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1594",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.595.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1595",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.596.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1596",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.597.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1597",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.598.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1598",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.599.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1599",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.600.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1600",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.601.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1601",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.602.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1602",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.603.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1603",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.604.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1604",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.605.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1605",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.606.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1606",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.607.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1607",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.608.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1608",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.609.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1609",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.610.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1610",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.611.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1611",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.612.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1612",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.613.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1613",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.614.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1614",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.615.pli": {
    title: "K\u0101yagat\u0101sati vagga - The Chapter on Mindfulness of the Body",
    description: "Short teachings on the benefits of cultivating mindfulness of the body",
    fetter: "ignorance",
    tags: "mindfulness,mindfulness of body,awareness",
    id: "an1.575-615",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.575-615.pli#1615",
    updatedTime: "2024-08-09T01:23:31.000Z"
  },
  "an1.61-70.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.61.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#161",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.62.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#162",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.63.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#163",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.64.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#164",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.65.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#165",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.66.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#166",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.67.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#167",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.68.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#168",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.69.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#169",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.70.en": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.en#170",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.61-70.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.61.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#161",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.62.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#162",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.63.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#163",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.64.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#164",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.65.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#165",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.66.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#166",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.67.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#167",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.68.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#168",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.69.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#169",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.70.pli": {
    title: "V\u012Briy\u0101rambh\u0101di vagga - The Chapter Beginning With Arousing Energy",
    description: "The Buddha explains the importance of arousing energy and the consequences of having many desires, few desires, dissatisfaction, contentment, (careless) attention, wise (careful, mindful) attention, lack of clear comprehension, clear comprehension (attentiveness), and bad friendship.",
    fetter: "ignorance",
    tags: "energy, desires, dissatisfaction, contentment, attention, clear comprehension, friends, wholesome, unwholesome, an, an1",
    id: "an1.61-70",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.61-70.pli#170",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.616-627.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.616.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1616",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.617.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1617",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.618.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1618",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.619.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1619",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.620.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1620",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.621.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1621",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.622.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1622",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.623.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1623",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.624.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1624",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.625.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1625",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.626.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1626",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.627.en": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.en#1627",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.616-627.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.616.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1616",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.617.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1617",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.618.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1618",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.619.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1619",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.620.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1620",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.621.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1621",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.622.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1622",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.623.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1623",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.624.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1624",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.625.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1625",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.626.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1626",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.627.pli": {
    title: "Amata vagga - The Chapter On The Deathless",
    description: "The Buddha explains the importance of mindfulness of the body in partaking in the deathless.",
    fetter: "ignorance",
    tags: "mindfulness, body, deathless, an, an1",
    id: "an1.616-627",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.616-627.pli#1627",
    updatedTime: "2024-09-23T09:35:28.000Z"
  },
  "an1.71-81.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.71.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#171",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.72.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#172",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.73.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#173",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.74.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#174",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.75.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#175",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.76.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#176",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.77.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#177",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.78.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#178",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.79.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#179",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.80.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#180",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.81.en": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.en#181",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.71-81.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.71.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#171",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.72.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#172",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.73.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#173",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.74.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#174",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.75.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#175",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.76.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#176",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.77.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#177",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.78.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#178",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.79.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#179",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.80.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#180",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.81.pli": {
    title: "Kaly\u0101\u1E47amitt\u0101di vagga - The Chapter Beginning With Good Friendship",
    description: "The Buddha explains the importance of good friendship, the consequences of habitual engagement in unwholesome and wholesome qualities, wise and unwise attention, the loss or increase of relatives, wealth, and reputation contrasted with the loss or increase of wisdom.",
    fetter: "ignorance",
    tags: "friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, an, an1",
    id: "an1.71-81",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.71-81.pli#181",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an1.82-97.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.82.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#182",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.83.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#183",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.84.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#184",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.85.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#185",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.86.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#186",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.87.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#187",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.88.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#188",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.89.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#189",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.90.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#190",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.91.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#191",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.92.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#192",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.93.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#193",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.94.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#194",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.95.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#195",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.96.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#196",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.97.en": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.en#197",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.82-97.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.82.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#182",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.83.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#183",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.84.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#184",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.85.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#185",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.86.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#186",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.87.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#187",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.88.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#188",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.89.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#189",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.90.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#190",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.91.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#191",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.92.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#192",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.93.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#193",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.94.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#194",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.95.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#195",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.96.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#196",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.97.pli": {
    title: "Pam\u0101d\u0101di vagga - The Chapter Beginning With Negligence",
    description: "The Buddha explains the consequences of negligence and diligence, laziness and arousing of energy, having many desires and having few wishes, discontentment and contentment, unwise and wise attention, wrong and right view, full awareness and lack of it, bad and good friendship.",
    fetter: "ignorance",
    tags: "negligence, diligence, laziness, arousing of energy, desires, wishes, discontentment, contentment, wise attention, right view, full awareness, friendship, an, an1",
    id: "an1.82-97",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.82-97.pli#197",
    updatedTime: "2024-08-19T12:46:13.000Z"
  },
  "an1.98-139.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.98.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#198",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.99.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#199",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.100.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1100",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.101.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1101",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.102.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1102",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.103.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1103",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.104.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1104",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.105.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1105",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.106.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1106",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.107.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1107",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.108.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1108",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.109.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1109",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.110.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1110",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.111.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1111",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.112.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1112",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.113.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1113",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.114.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1114",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.115.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1115",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.116.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1116",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.117.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1117",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.118.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1118",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.119.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1119",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.120.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1120",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.121.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1121",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.122.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1122",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.123.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1123",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.124.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1124",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.125.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1125",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.126.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1126",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.127.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1127",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.128.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1128",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.129.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1129",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.130.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1130",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.131.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1131",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.132.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1132",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.133.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1133",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.134.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1134",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.135.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1135",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.136.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1136",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.137.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1137",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.138.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1138",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.139.en": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.en#1139",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an1.98-139.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.98.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#198",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.99.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#199",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.100.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1100",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.101.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1101",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.102.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1102",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.103.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1103",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.104.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1104",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.105.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1105",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.106.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1106",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.107.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1107",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.108.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1108",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.109.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1109",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.110.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1110",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.111.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1111",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.112.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1112",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.113.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1113",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.114.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1114",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.115.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1115",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.116.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1116",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.117.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1117",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.118.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1118",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.119.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1119",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.120.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1120",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.121.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1121",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.122.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1122",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.123.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1123",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.124.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1124",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.125.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1125",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.126.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1126",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.127.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1127",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.128.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1128",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.129.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1129",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.130.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1130",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.131.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1131",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.132.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1132",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.133.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1133",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.134.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1134",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.135.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1135",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.136.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1136",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.137.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1137",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.138.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1138",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an1.139.pli": {
    title: "Dutiyapam\u0101d\u0101di vagga - Second Chapter Starting With Negligence",
    description: "The Buddha lists the mental qualities that form the internal factors leading to harm or benefit, the qualities that lead to the decline or continuity of the true Dhamma, and the actions that lead to the harm of many people.",
    fetter: "ignorance",
    tags: "harm, benefit, true Dhamma, friends, habits, attention, wisdom, relatives, wealth, reputation, wholesome, unwholesome, teaching, discipline, vinaya, spoken, practiced, prescribed, an, an1",
    id: "an1.98-139",
    commentary: "1.99 - Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining alertness and care (gentleness).\n",
    path: "/an/an1/",
    fullPath: "/an/an1/an1.98-139.pli#1139",
    updatedTime: "2024-09-19T10:38:13.000Z"
  },
  "an10.103.en": {
    title: "Micchatta sutta - Wrongness",
    description: "Approaching wrongness leads to failure, not success. Approaching rightness leads to success, not failure.",
    fetter: "ignorance",
    tags: "wrong view, wrong intention, wrong speech, wrong action, wrong livelihood, wrong effort, wrong mindfulness, wrong collectedness, wrong wisdom, false liberation, right view, right intention, right speech, right action, right livelihood, right effort, right mindfulness, right collectedness, right wisdom, true liberation, an, an10",
    id: "an10.103",
    path: "/an/an10/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an10.103.pli": {
    title: "Micchatta sutta - Wrongness",
    description: "Approaching wrongness leads to failure, not success. Approaching rightness leads to success, not failure.",
    fetter: "ignorance",
    tags: "wrong view, wrong intention, wrong speech, wrong action, wrong livelihood, wrong effort, wrong mindfulness, wrong collectedness, wrong wisdom, false liberation, right view, right intention, right speech, right action, right livelihood, right effort, right mindfulness, right collectedness, right wisdom, true liberation, an, an10",
    id: "an10.103",
    path: "/an/an10/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an10.104.en": {
    title: "B\u012Bja sutta - Seeds",
    description: "With wrong view, all actions lead to suffering. With right view, all actions lead to happiness. The Buddha explains this with an example of seeds.",
    fetter: "ignorance",
    tags: "wrong view, right view, wrong intention, right intention, wrong speech, right speech, wrong action, right action, wrong livelihood, right livelihood, wrong effort, right effort, wrong mindfulness, right mindfulness, wrong collectedness, right collectedness, wrong wisdom, right wisdom, false liberation, true liberation, an, an10",
    id: "an10.104",
    path: "/an/an10/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an10.104.pli": {
    title: "B\u012Bja sutta - Seeds",
    description: "With wrong view, all actions lead to suffering. With right view, all actions lead to happiness. The Buddha explains this with an example of seeds.",
    fetter: "ignorance",
    tags: "wrong view, right view, wrong intention, right intention, wrong speech, right speech, wrong action, right action, wrong livelihood, right livelihood, wrong effort, right effort, wrong mindfulness, right mindfulness, wrong collectedness, right collectedness, wrong wisdom, right wisdom, false liberation, true liberation, an, an10",
    id: "an10.104",
    path: "/an/an10/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an10.90.en": {
    title: "Kh\u012B\u1E47\u0101savabala sutta - Strength Of One Who Has Exhausted Defilements",
    description: "Venerable S\u0101riputta explains the ten strengths of a bhikkhu who has exhausted the defilements.",
    fetter: "ignorance",
    tags: "defilements,strengths,formations,sensual desire,seclusion,mindfulness,right efforts,psychic abilities,faculties,strengths,factors of awakening,noble eightfold path,an,an10",
    id: "an10.90",
    path: "/an/an10/",
    updatedTime: "2024-09-15T13:51:53.000Z"
  },
  "an10.90.pli": {
    title: "Kh\u012B\u1E47\u0101savabala sutta - Strength Of One Who Has Exhausted Defilements",
    description: "Venerable S\u0101riputta explains the ten strengths of a bhikkhu who has exhausted the defilements.",
    fetter: "ignorance",
    tags: "defilements,strengths,formations,sensual desire,seclusion,mindfulness,right efforts,psychic abilities,faculties,strengths,factors of awakening,noble eightfold path,an,an10",
    id: "an10.90",
    path: "/an/an10/",
    updatedTime: "2024-09-15T13:51:53.000Z"
  },
  "an11.15.en": {
    title: "Mett\u0101 sutta - Loving-Kindness",
    description: "11 benefits of cultivating loving-kindness from sleeping with ease to dying unconfused to going to the Brahma world.",
    fetter: "ill-will",
    tags: "loving-kindness, good-will, non-ill-will, ill-will, an, an11",
    id: "an11.15",
    path: "/an/an11/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an11.15.pli": {
    title: "Mett\u0101 sutta - Loving-Kindness",
    description: "11 benefits of cultivating loving-kindness from sleeping with ease to dying unconfused to going to the Brahma world.",
    fetter: "ill-will",
    tags: "loving-kindness, good-will, non-ill-will, ill-will, an, an11",
    id: "an11.15",
    path: "/an/an11/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an2.1-10.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.1.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#21",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.2.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#22",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.3.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#23",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.4.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#24",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.5.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#25",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.6.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#26",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.7.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#27",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.8.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#28",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.9.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#29",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.10.en": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.en#210",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "an2.1-10.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.1.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#21",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.2.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#22",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.3.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#23",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.4.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#24",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.5.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#25",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.6.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#26",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.7.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#27",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.8.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#28",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.9.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#29",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.10.pli": {
    title: "Kammakara\u1E47a vagga - The Chapter On The Undertaking Of Actions",
    description: "The Buddha explains the faults concerning this life and the next life, the strivings for laypeople and those who have gone forth, the things that cause regret and do not cause regret, the importance of not resting content with wholesome qualities, the two things that cause regret and do not cause regret, the two dark and bright qualities, and the two occasions for approaching the rains retreat.",
    fetter: "personal existence,adherence to rites and rituals,ignorance",
    tags: "fault, life, next life, striving, laypeople, gone forth, regret, not regret, wholesome, tirelessness, heedfulness, bright, dark, protection, rains retreat, an, an2",
    id: "an2.1-10",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.1-10.pli#210",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.118-129.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.118.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2118",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.119.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2119",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.120.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2120",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.121.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2121",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.122.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2122",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.123.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2123",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.124.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2124",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.125.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2125",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.126.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2126",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.127.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2127",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.128.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2128",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.129.en": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.en#2129",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.118-129.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.118.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2118",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.119.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2119",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.120.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2120",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.121.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2121",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.122.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2122",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.123.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2123",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.124.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2124",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.125.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2125",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.126.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2126",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.127.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2127",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.128.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2128",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.129.pli": {
    title: "\u0100s\u0101duppajaha vagga - The Chapter Beginning WIth The Difficult to Abandon",
    description: "The Buddha teaches on two hopes that are difficult to abandon, two kinds of people who are rare in the world, two kinds of people who are difficult to satisfy, two causes for the arising of passion, aversion, wrong view, and right view, and two kinds of offenses.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "acquisition,existence,gratitude,content,passion,aversion,wrong view,right view,offense,an,an2",
    id: "an2.118-129",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.118-129.pli#2129",
    updatedTime: "2024-08-30T15:55:58.000Z"
  },
  "an2.21-31.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.21.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#221",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.22.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#222",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.23.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#223",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.24.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#224",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.25.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#225",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.26.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#226",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.27.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#227",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.28.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#228",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.29.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#229",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.30.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#230",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.31.en": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.en#231",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "an2.21-31.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.21.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#221",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.22.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#222",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.23.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#223",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.24.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#224",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.25.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#225",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.26.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#226",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.27.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#227",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.28.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#228",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.29.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#229",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.30.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#230",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.31.pli": {
    title: "B\u0101la vagga - The Chapter Beginning With The Immature",
    description: "The Buddha contrasts the immature and wise persons, shares on who misrepresents the Buddha, virtuous and unprincipled behavior, wrong and right view, why he dwells in forests and remote lodgings, and the importance of tranquility and insight.",
    fetter: "ignorance",
    tags: "immature, wise, misrepresent, virtuous, unprincipled, wrong view, right view, forest, remote, tranquility, insight, an, an2",
    id: "an2.21-31",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.21-31.pli#231",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.32-41.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.32.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#232",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.33.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#233",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.34.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#234",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.35.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#235",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.36.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#236",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.37.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#237",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.38.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#238",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.39.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#239",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.40.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#240",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.41.en": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.en#241",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an2.32-41.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.32.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#232",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.33.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#233",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.34.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#234",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.35.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#235",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.36.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#236",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.37.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#237",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.38.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#238",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.39.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#239",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.40.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#240",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.41.pli": {
    title: "Samacitta vagga - The Chapter on the Even-Minded",
    description: "The Buddha teaches about integrity, gratitude, how one can repay one's parents, action and non-action, who to make offerings to, persons who are internally or externally fettered, and the importance of right practice and well grasp of the Dhamma. The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
    fetter: "adherence to rites and rituals,sensual desire,personal existence,conceit",
    tags: "integrity,parents,good conduct,bad conduct,even mind,immature,wise,wrong grasp,well grasp,fetters,personal existence,conceit,an,an2",
    id: "an2.32-41",
    commentary: "[1] In AN 2.36, the fettered internally (bound in oneself) is a reference to the five lower fetters of personal existence view, doubt, adherence to rites and rituals, sensual desire, and ill-will. This refers to a person training to attain stream-entry, a stream-enterer, or a once-returner.\n[2] In AN 2.36, the fettered externally (bound outwardly) is a reference to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. This refers to a non-returner.\n",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.32-41.pli#241",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an2.52-63.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.52.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#252",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.53.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#253",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.54.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#254",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.55.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#255",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.56.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#256",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.57.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#257",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.58.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#258",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.59.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#259",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.60.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#260",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.61.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#261",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.62.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#262",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.63.en": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.en#263",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.52-63.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.52.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#252",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.53.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#253",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.54.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#254",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.55.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#255",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.56.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#256",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.57.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#257",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.58.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#258",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.59.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#259",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.60.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#260",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.61.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#261",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.62.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#262",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an2.63.pli": {
    title: "Puggala vagga - Persons",
    description: "The Buddha explains the importance of the perfectly enlightened one and the wheel-turning monarch, shares about the two types of Buddhas, who does not tremble when a thunder strikes, how living with the unvirtuous and virtuous occurs, and the consequences of not internally settling contention of views and resentment arising from a disciplinary issue.",
    fetter: "ignorance",
    tags: "Tath\u0101gata, Arahant, wheel-turning monarch, Buddha, Paccekabuddha, discipline, contention, resentment, acrimony, animosity, virtuous, unvirtuous, an, an2",
    id: "an2.52-63",
    path: "/an/an2/",
    fullPath: "/an/an2/an2.52-63.pli#263",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "an3.139.en": {
    title: "Vuddhi sutta - Growth",
    description: "The Buddha shares in brief the three types of growth - 1. confidence, 2. virtue, and 3. wisdom.",
    fetter: "doubt",
    tags: "confidence, virtue, wisdom, growth, an, an3",
    id: "an3.139",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.139.pli": {
    title: "Vuddhi sutta - Growth",
    description: "The Buddha shares in brief the three types of growth - 1. confidence, 2. virtue, and 3. wisdom.",
    fetter: "doubt",
    tags: "confidence, virtue, wisdom, growth, an, an3",
    id: "an3.139",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.17.en": {
    title: "Attaby\u0101b\u0101dha sutta - Self-Infliction of Harm",
    description: "The Buddha explains how bodily, verbal, and mental misconduct lead to self-infliction of harm.",
    fetter: "ill-will,conceit",
    tags: "an,an3,conduct,ill-will,conceit",
    id: "an3.17",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.17.pli": {
    title: "Attaby\u0101b\u0101dha sutta - Self-Infliction of Harm",
    description: "The Buddha explains how bodily, verbal, and mental misconduct lead to self-infliction of harm.",
    fetter: "ill-will,conceit",
    tags: "an,an3,conduct,ill-will,conceit",
    id: "an3.17",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.2.en": {
    title: "Lakkha\u1E47a sutta - Characteristics",
    description: "The Buddha explains the characteristics of an immature and wise person.",
    fetter: "ignorance",
    tags: "an,an3,ignorance,conduct",
    id: "an3.2",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.2.pli": {
    title: "Lakkha\u1E47a sutta - Characteristics",
    description: "The Buddha explains the characteristics of an immature and wise person.",
    fetter: "ignorance",
    tags: "an,an3,ignorance,conduct",
    id: "an3.2",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.25.en": {
    title: "Vajir\u016Bpama sutta - Like a Diamond",
    description: "The Buddha explains the three types of persons existing in the world based on their mental qualities.",
    fetter: "ignorance",
    tags: "an,an3,ignorance,mind",
    id: "an3.25",
    path: "/an/an3/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "an3.25.pli": {
    title: "Vajir\u016Bpama sutta - Like a Diamond",
    description: "The Buddha explains the three types of persons existing in the world based on their mental qualities.",
    fetter: "ignorance",
    tags: "an,an3,ignorance,mind",
    id: "an3.25",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.31.en": {
    title: "Sabrahmaka sutta - With Brahm\u0101",
    description: "Where children honor their mother and father, those families are said to dwell with Brahm\u0101.",
    fetter: "ignorance",
    tags: "an,an3,brahm\u0101,parents,mother,father,family,children,wise",
    id: "an3.31",
    path: "/an/an3/",
    updatedTime: "2024-07-24T02:30:01.000Z"
  },
  "an3.31.pli": {
    title: "Sabrahmaka sutta - With Brahm\u0101",
    description: "Where children honor their mother and father, those families are said to dwell with Brahm\u0101.",
    fetter: "ignorance",
    tags: "an,an3,brahm\u0101,parents,mother,father,family,children,wise",
    id: "an3.31",
    path: "/an/an3/",
    updatedTime: "2024-07-24T02:30:01.000Z"
  },
  "an3.47.en": {
    title: "Sa\u1E45khatalakkha\u1E47a sutta - Characteristics Of The Conditioned",
    description: "The three characteristics of the conditioned and the unconditioned.",
    fetter: "ignorance",
    tags: "conditioned, unconditioned, arising, passing away, alteration, an, an3",
    id: "an3.47",
    path: "/an/an3/",
    updatedTime: "2024-08-22T14:58:57.000Z"
  },
  "an3.47.pli": {
    title: "Sa\u1E45khatalakkha\u1E47a sutta - Characteristics Of The Conditioned",
    description: "The three characteristics of the conditioned and the unconditioned.",
    fetter: "ignorance",
    tags: "conditioned, unconditioned, arising, passing away, alteration, an, an3",
    id: "an3.47",
    path: "/an/an3/",
    updatedTime: "2024-08-22T14:58:57.000Z"
  },
  "an3.66.en": {
    title: "S\u0101\u1E37ha sutta - With S\u0101\u1E37ha",
    description: "The venerable Nandaka teaches S\u0101\u1E37ha and his friend about the unwholesome and wholesome mental qualities.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "greed,aversion,delusion,wholesome,unwholesome,blameless,blameworthy,wise,loving-kindness,good-will,contentment,clear apprehension",
    id: "an3.66",
    path: "/an/an3/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an3.66.pli": {
    title: "S\u0101\u1E37ha sutta - With S\u0101\u1E37ha",
    description: "The venerable Nandaka teaches S\u0101\u1E37ha and his friend about the unwholesome and wholesome mental qualities.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "greed,aversion,delusion,wholesome,unwholesome,blameless,blameworthy,wise,loving-kindness,good-will,contentment,clear apprehension",
    id: "an3.66",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.69.en": {
    title: "Akusalam\u016Bla sutta - Unwholesome Roots",
    description: "The Buddha explains the three unwholesome roots and the three wholesome roots.",
    fetter: "ignorance, sensual desire, ill-will",
    tags: "greed, hatred, delusion, contentment, good-will, wisdom, an, an3, unwholesome, wholesome",
    id: "an3.69",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an3.69.pli": {
    title: "Akusalam\u016Bla sutta - Unwholesome Roots",
    description: "The Buddha explains the three unwholesome roots and the three wholesome roots.",
    fetter: "ignorance, sensual desire, ill-will",
    tags: "greed, hatred, delusion, contentment, good-will, wisdom, an, an3, unwholesome, wholesome",
    id: "an3.69",
    path: "/an/an3/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.132.en": {
    title: "Pa\u1E6Dibh\u0101na sutta - Eloquence",
    description: "The four types of people found in the world based on the presence or absence of rational and spontaneous eloquence.",
    fetter: "ignorance",
    tags: "eloquence, rational, spontaneous, an, an4",
    id: "an4.132",
    path: "/an/an4/",
    updatedTime: "2024-09-22T12:15:00.000Z"
  },
  "an4.132.pli": {
    title: "Pa\u1E6Dibh\u0101na sutta - Eloquence",
    description: "The four types of people found in the world based on the presence or absence of rational and spontaneous eloquence.",
    fetter: "ignorance",
    tags: "eloquence, rational, spontaneous, an, an4",
    id: "an4.132",
    path: "/an/an4/",
    updatedTime: "2024-09-22T12:15:00.000Z"
  },
  "an4.143.en": {
    title: "\u0100loka sutta - Illumination",
    description: "The Buddha shares in brief the four illuminations - 1. the moon, 2. the sun, 3. fire, and 4. wisdom.",
    fetter: "ignorance",
    tags: "moon, sun, fire, wisdom, illumination, an, an4",
    id: "an4.143",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.143.pli": {
    title: "\u0100loka sutta - Illumination",
    description: "The Buddha shares in brief the four illuminations - 1. the moon, 2. the sun, 3. fire, and 4. wisdom.",
    fetter: "ignorance",
    tags: "moon, sun, fire, wisdom, illumination, an, an4",
    id: "an4.143",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.169.en": {
    title: "Sasa\u1E45kh\u0101ra  sutta - Residual Formations",
    description: "The Buddha describes four ways to attain final Nibb\u0101na with or without exertion.",
    fetter: "ignorance",
    tags: "exertion, tranquility, insight, wisdom, an, an4",
    id: "an4.169",
    path: "/an/an4/",
    updatedTime: "2024-08-18T14:36:46.000Z"
  },
  "an4.169.pli": {
    title: "Sasa\u1E45kh\u0101ra  sutta - Residual Formations",
    description: "The Buddha describes four ways to attain final Nibb\u0101na with or without residual formations.",
    fetter: "ignorance",
    tags: "residual formations, tranquility, insight, wisdom, an, an4",
    id: "an4.169",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.170.en": {
    title: "Yuganaddha sutta - In Tandem",
    description: "The Venerable \u0100nanda explains the four paths to arahantship.",
    fetter: "ignorance",
    tags: "an,an4,tranquility,insight,arahantship",
    id: "an4.170",
    path: "/an/an4/",
    updatedTime: "2024-09-23T04:57:55.000Z"
  },
  "an4.170.pli": {
    title: "Yuganaddha sutta - In Tandem",
    description: "The Venerable \u0100nanda explains the four paths to arahantship.",
    fetter: "ignorance",
    tags: "an,an4,tranquility,insight,arahantship",
    id: "an4.170",
    path: "/an/an4/",
    updatedTime: "2024-07-21T10:11:58.000Z"
  },
  "an4.186.en": {
    title: "Ummagga sutta - Fundamental Questions",
    description: "A bhikkhu asks the Buddha about the nature of the world, the mind, and wisdom.",
    fetter: "ignorance",
    tags: "an,an4,ignorance,mind,wisdom",
    id: "an4.186",
    path: "/an/an4/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "an4.186.pli": {
    title: "Ummagga sutta - Fundamental Questions",
    description: "A bhikkhu asks the Buddha about the nature of the world, the mind, and wisdom.",
    fetter: "ignorance",
    tags: "an,an4,ignorance,mind,wisdom",
    id: "an4.186",
    path: "/an/an4/",
    updatedTime: "2024-07-21T10:11:58.000Z"
  },
  "an4.199.en": {
    title: "Ta\u1E47h\u0101 sutta - Craving",
    description: "The eighteen ways of craving pertaining to the internal bases, and the eighteen ways of craving pertaining to the external bases.",
    fetter: "conceit",
    tags: "craving,an,an4,conceit",
    id: "an4.199",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.199.pli": {
    title: "Ta\u1E47h\u0101 sutta - Craving",
    description: "The eighteen ways of craving pertaining to the internal bases, and the eighteen ways of craving pertaining to the external bases.",
    fetter: "conceit",
    tags: "craving,an,an4,conceit",
    id: "an4.199",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.21.en": {
    title: "Pa\u1E6Dhamauruvela  sutta - Uruvel\u0101 (First)",
    description: "The Buddha reflects on the Dhamma after his enlightenment and is encouraged by Brahm\u0101 Sahampati to rely on the Dhamma.",
    fetter: "doubt",
    tags: "buddha,an,an4,doubt",
    id: "an4.21",
    path: "/an/an4/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an4.21.pli": {
    title: "Pa\u1E6Dhamauruvela  sutta - Uruvel\u0101 (First)",
    description: "The Buddha reflects on the Dhamma after his enlightenment and is encouraged by Brahm\u0101 Sahampati to rely on the Dhamma.",
    fetter: "doubt",
    tags: "buddha,an,an4,doubt",
    id: "an4.21",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.221.en": {
    title: "Duccarita sutta - Misconducts",
    description: "The four verbal misconducts and the four good verbal conducts.",
    fetter: "ignorance",
    tags: "right speech,an,an4",
    id: "an4.221",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.221.pli": {
    title: "Duccarita sutta - Misconducts",
    description: "The four verbal misconducts and the four good verbal conducts.",
    fetter: "ignorance",
    tags: "right speech,an,an4",
    id: "an4.221",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.23.en": {
    title: "Loka sutta - World",
    description: "The Buddha explains why he is called the Tath\u0101gata, the one who has fully comprehended the world, its arising, cessation, and the path leading to its cessation.",
    fetter: "ignorance, doubt",
    tags: "tathagata, world, doubt, defilements, iti, four noble truths, ignorance, doubt",
    id: "an4.23",
    path: "/an/an4/",
    updatedTime: "2024-08-10T15:08:23.000Z"
  },
  "an4.23.pli": {
    title: "Loka sutta - World",
    description: "The Buddha explains why he is called the Tath\u0101gata, the one who has fully comprehended the world, its arising, cessation, and the path leading to its cessation.",
    fetter: "ignorance, doubt",
    tags: "tathagata, world, doubt, defilements, iti, four noble truths, ignorance, doubt",
    id: "an4.23",
    path: "/an/an4/",
    updatedTime: "2024-07-24T04:13:39.000Z"
  },
  "an4.24.en": {
    title: "K\u0101\u1E37ak\u0101r\u0101ma sutta - At K\u0101\u1E37aka's park",
    description: "The Buddha does not cling to anything so when he sees, hears, senses, or cognizes, he does not formulate the seen, the unseen, what can be seen, or one who sees. He does not formulate the heard, the unheard, what can be heard, or one who hears. He does not formulate the sensed, the unsensed, what can be sensed, or one who senses. He does not formulate the cognized, the uncognized, what can be cognized, or one who cognizes.",
    fetter: "ignorance",
    tags: "ignorance,clinging,formulation,an,an4",
    id: "an4.24",
    path: "/an/an4/",
    updatedTime: "2024-08-10T15:08:23.000Z"
  },
  "an4.24.pli": {
    title: "K\u0101\u1E37ak\u0101r\u0101ma sutta - At K\u0101\u1E37aka's park",
    description: "The Buddha does not cling to anything so when he sees, hears, senses, or cognizes, he does not formulate the seen, the unseen, what can be seen, or one who sees. He does not formulate the heard, the unheard, what can be heard, or one who hears. He does not formulate the sensed, the unsensed, what can be sensed, or one who senses. He does not formulate the cognized, the uncognized, what can be cognized, or one who cognizes.",
    fetter: "ignorance",
    tags: "ignorance,clinging,formulation,an,an4",
    id: "an4.24",
    path: "/an/an4/",
    updatedTime: "2024-08-10T15:08:23.000Z"
  },
  "an4.248.en": {
    title: "Pa\xF1\xF1\u0101vuddhi sutta - Growth Of Wisdom",
    description: "The four things that lead to the growth of wisdom.",
    fetter: "ignorance",
    tags: "wisdom, growth, good people, Dhamma, wise attention, yoniso manasik\u0101ra, practice, an, an4",
    id: "an4.248",
    path: "/an/an4/",
    updatedTime: "2024-08-22T14:58:57.000Z"
  },
  "an4.248.pli": {
    title: "Pa\xF1\xF1\u0101vuddhi sutta - Growth Of Wisdom",
    description: "The four things that lead to the growth of wisdom.",
    fetter: "ignorance",
    tags: "wisdom, growth, good people, Dhamma, wise attention, yoniso manasik\u0101ra, practice, an, an4",
    id: "an4.248",
    path: "/an/an4/",
    updatedTime: "2024-08-22T14:58:57.000Z"
  },
  "an4.25.en": {
    title: "Brahmacariya sutta - The Spiritual Life",
    description: "The Buddha explains the purpose of the spiritual life.",
    fetter: "conceit",
    tags: "an,an4,spiritual life, conceit",
    id: "an4.25",
    path: "/an/an4/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "an4.25.pli": {
    title: "Brahmacariya sutta - The Spiritual Life",
    description: "The Buddha explains the purpose of the spiritual life.",
    fetter: "conceit",
    tags: "an,an4,spiritual life, conceit",
    id: "an4.25",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.254.en": {
    title: "Abhi\xF1\xF1\u0101 sutta - Direct Knowing",
    description: "The four things that should be fully comprehended, abandoned, developed, and personally realized by direct knowing.",
    fetter: "ignorance",
    tags: "an,an4,things,five aggregates,ignorance,craving,tranquility,insight,wisdom,liberation",
    id: "an4.254",
    path: "/an/an4/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "an4.254.pli": {
    title: "Abhi\xF1\xF1\u0101 sutta - Direct Knowledge",
    description: "The four mental qualities that should be fully comprehended, abandoned, developed, and personally realized by direct knowledge.",
    fetter: "ignorance",
    tags: "an,an4,mental qualities,five aggregates,ignorance,craving,tranquility,insight,wisdom,liberation",
    id: "an4.254",
    path: "/an/an4/",
    updatedTime: "2024-07-21T10:11:58.000Z"
  },
  "an4.276.en": {
    title: "Iddhip\u0101da sutta - Psychic Ability",
    description: "The four bases of psychic ability that should be developed for the full understanding of passion, desire, and attachment.",
    fetter: "sensual desire, desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "an,an4,spiritual power,psychic ability,passion,desire,attachment,collectedness,goal,aspiration,interest,objective,intention,effort,persistence,mind,consciousness,investigation,reflection,close examination",
    id: "an4.276",
    path: "/an/an4/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "an4.276.pli": {
    title: "Iddhip\u0101da sutta - Psychic Ability",
    description: "The four bases of psychic ability that should be developed for the full understanding of passion, desire, and attachment.",
    fetter: "sensual desire, desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "an,an4,spiritual power,psychic ability,passion,desire,attachment,collectedness,goal,aspiration,interest,objective,intention,effort,persistence,mind,consciousness,investigation,reflection,close examination",
    id: "an4.276",
    path: "/an/an4/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an4.29.en": {
    title: "Dhammapada  sutta - The Four Dhamma Principles",
    description: "The Buddha explains the four Dhamma principles that are foremost, ancient, rooted in tradition, timeless, and pure.",
    fetter: "ignorance",
    tags: "dhamma,an,an4,ignorance,contentment,good-will, mindfulness,collectedness",
    id: "an4.29",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.29.pli": {
    title: "Dhammapada  sutta - The Four Dhamma Principles",
    description: "The Buddha explains the four Dhamma principles that are foremost, ancient, rooted in tradition, timeless, and pure.",
    fetter: "ignorance",
    tags: "dhamma,an,an4,ignorance,contentment,good-will, mindfulness,collectedness",
    id: "an4.29",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.32.en": {
    title: "Sa\u1E45gaha sutta - Supportive",
    description: "The Buddha explains the four bases of a supportive relationship.",
    fetter: "ill-will,conceit",
    tags: "an,an4,relationships,ill-will,conceit",
    id: "an4.32",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.32.pli": {
    title: "Sa\u1E45gaha sutta - Supportive",
    description: "The Buddha explains the four bases of a supportive relationship.",
    fetter: "ill-will,conceit",
    tags: "an,an4,relationships,ill-will,conceit",
    id: "an4.32",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.43.en": {
    title: "Pa\u1E6Dhamakodhagaru sutta - Valuing Anger (First)",
    description: "The Buddha shares the four kinds of persons found in the world - those who value anger, contempt, gain, and honor, and those who value the good Dhamma instead.",
    fetter: "ill-will,sensual desire",
    tags: "anger, contempt, gain, honor, good Dhamma, ill-will, sensual desire, an, an4",
    id: "an4.43",
    path: "/an/an4/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "an4.43.pli": {
    title: "Pa\u1E6Dhamakodhagaru sutta - Valuing Anger (First)",
    description: "The Buddha shares the four kinds of persons found in the world - those who value anger, contempt, gain, and honor, and those who value the good Dhamma instead.",
    fetter: "ill-will,sensual desire",
    tags: "anger, contempt, gain, honor, good Dhamma, ill-will, sensual desire, an, an4",
    id: "an4.43",
    path: "/an/an4/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "an4.44.en": {
    title: "Dutiyakodhagaru sutta - Valuing Anger (Second)",
    description: "The Buddha shares the four unwholesome practices of valuing anger, contempt, gain, and honor, and the four wholesome practices of valuing the good Dhamma instead.",
    fetter: "ill-will, sensual desire",
    tags: "anger, contempt, gain, honor, good Dhamma, ill-will, sensual desire, an, an4",
    id: "an4.44",
    path: "/an/an4/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "an4.44.pli": {
    title: "Dutiyakodhagaru sutta - Valuing Anger (Second)",
    description: "The Buddha shares the four unwholesome practices of valuing anger, contempt, gain, and honor, and the four wholesome practices of valuing the good Dhamma instead.",
    fetter: "ill-will, sensual desire",
    tags: "anger, contempt, gain, honor, good Dhamma, ill-will, sensual desire, an, an4",
    id: "an4.44",
    path: "/an/an4/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "an4.5.en": {
    title: "Anusota sutta - Along the Current",
    description: "The Buddha describes the four types of persons found in the world - those who go with the current, those who go against the current, those who are steady, and those who have crossed over, standing on the firm ground, arahants.",
    fetter: "doubt, ignorance",
    tags: "current, sensual pleasures, sensual desire, unwholesome actions, arahant, an, an4",
    id: "an4.5",
    path: "/an/an4/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "an4.5.pli": {
    title: "Anusota sutta - Along the Current",
    description: "The Buddha describes the four types of persons found in the world - those who go with the current, those who go against the current, those who are steady, and those who have crossed over, standing on the firm ground, arahants.",
    fetter: "doubt, ignorance",
    tags: "current, sensual pleasures, sensual desire, unwholesome actions, arahant, an, an4",
    id: "an4.5",
    path: "/an/an4/",
    updatedTime: "2024-08-02T12:32:47.000Z"
  },
  "an4.6.en": {
    title: "Appassuta sutta - Little Learned",
    description: "The Buddha describes the four types of persons found in the world - those with little learning who are not accomplished by that learning, those with little learning who are accomplished by that learning, those with much learning who are not accomplished by that learning, and those with much learning who are accomplished by that learning.",
    fetter: "doubt, adherence to rites and rituals",
    tags: "virtue, learning, wisdom, praise, criticism, an, an4",
    id: "an4.6",
    path: "/an/an4/",
    updatedTime: "2024-08-02T12:32:47.000Z"
  },
  "an4.6.pli": {
    title: "Appassuta sutta - Little Learned",
    description: "The Buddha describes the four types of persons found in the world - those with little learning who are not accomplished by that learning, those with little learning who are accomplished by that learning, those with much learning who are not accomplished by that learning, and those with much learning who are accomplished by that learning.",
    fetter: "doubt, adherence to rites and rituals",
    tags: "virtue, learning, wisdom, praise, criticism, an, an4",
    id: "an4.6",
    path: "/an/an4/",
    updatedTime: "2024-08-02T12:32:47.000Z"
  },
  "an4.77.en": {
    title: "Acinteyya sutta - The Inconceivable",
    description: "The domain of wisdom of the Buddhas, on one in jh\u0101nas, the result of kamma, and speculation about the world are inconceivable and shouldn't be speculated over or thought about.",
    fetter: "doubt,ignorance",
    tags: "inconceivable,an,an4,speculation,universe,wisdom,kamma,jh\u0101na,buddha,confusion,distress",
    id: "an4.77",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.77.pli": {
    title: "Acinteyya sutta - The Inconceivable",
    description: "The domain of wisdom of the Buddhas, on one in jh\u0101nas, the result of kamma, and speculation about the world are inconceivable and shouldn't be speculated over or thought about.",
    fetter: "doubt,ignorance",
    tags: "inconceivable,an,an4,speculation,universe,wisdom,kamma,jh\u0101na,buddha,confusion,distress",
    id: "an4.77",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.8.en": {
    title: "Ves\u0101rajja sutta - Confidence",
    description: "The Buddha describes the four confidences possessed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "confidence, tath\u0101gata, realization, taints, obstruction, cessation of suffering, an, an4",
    id: "an4.8",
    path: "/an/an4/",
    updatedTime: "2024-08-02T12:32:47.000Z"
  },
  "an4.8.pli": {
    title: "Ves\u0101rajja sutta - Confidence",
    description: "The Buddha describes the four confidences possessed by the Tath\u0101gata.",
    fetter: "ignorance",
    tags: "confidence, tath\u0101gata, realization, taints, obstruction, cessation of suffering, an, an4",
    id: "an4.8",
    path: "/an/an4/",
    updatedTime: "2024-08-02T12:32:47.000Z"
  },
  "an4.92.en": {
    title: "Pa\u1E6Dhamasam\u0101dhi sutta - Collectedness (First)",
    description: "The Buddha describes the four kinds of persons found existing in the world.",
    fetter: "ignorance",
    tags: "tranquility, insight, wisdom, an, an4",
    id: "an4.92",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.92.pli": {
    title: "Pa\u1E6Dhamasam\u0101dhi  sutta - Collectedness (First)",
    description: "The Buddha describes the four kinds of persons found existing in the world.",
    fetter: "ignorance",
    tags: "tranquility, insight, wisdom, an, an4",
    id: "an4.92",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.93.en": {
    title: "Dutiyasam\u0101dhi  sutta - Collectedness (Second)",
    description: "The Buddha describes the four kinds of persons found existing in the world and how they can develop both tranquility and insight.",
    fetter: "ignorance",
    tags: "tranquility, insight, wisdom, an, an4",
    id: "an4.93",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.93.pli": {
    title: "Dutiyasam\u0101dhi  sutta - Collectedness (Second)",
    description: "The Buddha describes the four kinds of persons found existing in the world and how they can develop both tranquility and insight.",
    fetter: "ignorance",
    tags: "tranquility, insight, wisdom, an, an4",
    id: "an4.93",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.94.en": {
    title: "Tatiyasam\u0101dhi  sutta - Collectedness (Third)",
    description: "To develop tranquility and insight, one should ask experienced practitioners.",
    fetter: "ignorance",
    tags: "tranquility, insight, wisdom, an, an4",
    id: "an4.94",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.94.pli": {
    title: "Tatiyasam\u0101dhi  sutta - Collectedness (Third)",
    description: "To develop tranquility and insight, one should ask experienced practitioners.",
    fetter: "ignorance",
    tags: "tranquility, insight, wisdom, an, an4",
    id: "an4.94",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.97.en": {
    title: "Khippanisanti sutta - Quick To Attend To",
    description: "The Buddha explains the four types of persons existing in the world.",
    fetter: "ignorance",
    tags: "an,an4,ignorance,right speech,good-will, mindfulness,collectedness",
    id: "an4.97",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an4.97.pli": {
    title: "Khippanisanti sutta - Quick To Attend To",
    description: "The Buddha explains the four types of persons existing in the world.",
    fetter: "ignorance",
    tags: "an,an4,ignorance,right speech,good-will, mindfulness,collectedness",
    id: "an4.97",
    path: "/an/an4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an5.157.en": {
    title: "Dukkath\u0101 sutta - Difficult Discussions",
    description: "Five types of persons for whom specific discussions are difficult, and five types of persons for whom specific discussions are pleasant.",
    fetter: "conceit",
    tags: "faith, morality, learning, generosity, wisdom, an, an5",
    id: "an5.157",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.157.pli": {
    title: "Dukkath\u0101 sutta - Difficult Discussions",
    description: "Five types of persons for whom specific discussions are difficult, and five types of persons for whom specific discussions are pleasant.",
    fetter: "conceit",
    tags: "faith, morality, learning, generosity, wisdom, an, an5",
    id: "an5.157",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.161.en": {
    title: "Pa\u1E6Dhama\u0101gh\u0101tapa\u1E6Divinaya sutta - Overcoming Resentment (First)",
    description: "Five ways to overcome arisen resentment - 1) loving-kindness, 2) compassion, 3) equanimity, 4) disregarding and non-attention, 5) reflection on kamma.",
    fetter: "ill-will",
    tags: "resentment, ill-will, loving-kindness, compassion, equanimity, kamma, an, an5",
    id: "an5.161",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.161.pli": {
    title: "Pa\u1E6Dhama\u0101gh\u0101tapa\u1E6Divinaya sutta - Overcoming Resentment (First)",
    description: "Five ways to overcome arisen resentment - 1) loving-kindness, 2) compassion, 3) equanimity, 4) disregarding and non-attention, 5) reflection on kamma.",
    fetter: "ill-will",
    tags: "resentment, ill-will, loving-kindness, compassion, equanimity, kamma, an, an5",
    id: "an5.161",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.162.en": {
    title: "Dutiya\u0101gh\u0101tapa\u1E6Divinaya sutta - Overcoming Resentment (Second)",
    description: "Five ways to overcome arisen resentment",
    fetter: "ill-will",
    tags: "resentment, ill-will, body, speech, mind, mental clarity, an, an5",
    id: "an5.162",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.162.pli": {
    title: "Dutiya\u0101gh\u0101tapa\u1E6Divinaya sutta - Overcoming Resentment (Second)",
    description: "Five ways to overcome arisen resentment",
    fetter: "ill-will",
    tags: "resentment, ill-will, body, speech, mind, mental clarity, an, an5",
    id: "an5.162",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.198.en": {
    title: "V\u0101c\u0101 sutta - Speech",
    description: "Five factors of well-spoken speech.",
    fetter: "ill-will, sensual desire, conceit, personal existence",
    tags: "speech, an, an5",
    id: "an5.198",
    path: "/an/an5/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "an5.198.pli": {
    title: "V\u0101c\u0101 sutta - Speech",
    description: "Five factors of well-spoken speech.",
    fetter: "ill-will, sensual desire, conceit, self-identity view",
    tags: "speech, an, an5",
    id: "an5.198",
    path: "/an/an5/",
    updatedTime: "2024-08-03T04:17:14.000Z"
  },
  "an5.29.en": {
    title: "Ca\u1E45kama sutta - Walking Meditation",
    description: "The Buddha explains the benefits of walking meditation.",
    fetter: "doubt",
    tags: "walking meditation,meditation,doubt,an,an5",
    id: "an5.29",
    path: "/an/an5/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an5.29.pli": {
    title: "Ca\u1E45kama sutta - Walking Meditation",
    description: "The Buddha explains the benefits of walking meditation.",
    fetter: "doubt",
    tags: "walking meditation,meditation,doubt,an,an5",
    id: "an5.29",
    path: "/an/an5/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an5.48.en": {
    title: "Alabbhan\u012Bya\u1E6Dh\u0101na sutta - Unobtainable States",
    description: "How an uninstructed ordinary person and a learned disciple of the noble ones respond to the five unobtainable states of aging, illness, death, perishing, and loss.",
    fetter: "ignorance",
    tags: "aging, illness, death, perishing, loss, sorrow, suffering, ignorance, wisdom, an, an5",
    id: "an5.48",
    path: "/an/an5/",
    updatedTime: "2024-08-02T14:53:24.000Z"
  },
  "an5.48.guj": {
    title: "Alabbhan\u012Bya\u1E6Dh\u0101na sutta - \u0A85\u0AAA\u0ACD\u0AB0\u0ABE\u0AAA\u0ACD\u0AAF \u0A85\u0AB5\u0AB8\u0ACD\u0AA5\u0ABE\u0A93",
    description: "How an uninstructed ordinary person and a learned disciple of the noble ones respond to the five unobtainable states of aging, illness, death, perishing, and loss.",
    fetter: "ignorance",
    tags: "aging, illness, death, perishing, loss, sorrow, suffering, ignorance, wisdom, an, an5",
    id: "an5.48",
    path: "/an/an5/",
    updatedTime: "2024-08-02T14:53:24.000Z"
  },
  "an5.48.pli": {
    title: "Alabbhan\u012Bya\u1E6Dh\u0101na sutta - Unobtainable States",
    description: "How an uninstructed ordinary person and a learned disciple of the noble ones respond to the five unobtainable states of aging, illness, death, perishing, and loss.",
    fetter: "ignorance",
    tags: "aging, illness, death, perishing, loss, sorrow, suffering, ignorance, wisdom, an, an5",
    id: "an5.48",
    path: "/an/an5/",
    updatedTime: "2024-08-02T14:53:24.000Z"
  },
  "an5.56.en": {
    title: "Upajjh\u0101ya sutta - Mentor",
    description: "The Buddha explains how to overcome complacency and doubt by guarding the sense faculties, applying moderation in eating, being dedicated to wakefulness, developing insight into wholesome qualities, and engaging in the development of the awakening factors during the first and last watch of the night.",
    fetter: "doubt",
    tags: "mentor, complacency, doubt, sense bases, sense faculties, moderation, eating, wakefulness, insight, wholesome qualities, awakening factors, an, an5",
    id: "an5.56",
    path: "/an/an5/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "an5.56.pli": {
    title: "Upajjh\u0101ya sutta - Mentor",
    description: "The Buddha explains how to overcome complacency and doubt by guarding the sense faculties, applying moderation in eating, being dedicated to wakefulness, developing insight into wholesome qualities, and engaging in the development of the awakening factors during the first and last watch of the night.",
    fetter: "doubt",
    tags: "mentor, complacency, doubt, sense faculties, moderation, eating, wakefulness, insight, wholesome qualities, awakening factors, an, an5",
    id: "an5.56",
    path: "/an/an5/",
    updatedTime: "2024-08-05T13:24:57.000Z"
  },
  "an5.67.en": {
    title: "Pa\u1E6Dhamaiddhip\u0101da sutta - Bases for Psychic Ability (First)",
    description: "Developing the bases of psychic ability can lead to enlightenment in this very life or the state of non-returning.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, an, an5",
    id: "an5.67",
    path: "/an/an5/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "an5.67.pli": {
    title: "Pa\u1E6Dhamaiddhip\u0101da sutta - Bases for Psychic Ability (First)",
    description: "Developing the bases of psychic ability can lead to enlightenment in this very life or the state of non-returning.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, mind, investigation, reflection, close examination, an, an5",
    id: "an5.67",
    path: "/an/an5/",
    updatedTime: "2024-08-02T14:53:24.000Z"
  },
  "an5.68.en": {
    title: "Pa\u1E6Dhamaiddhip\u0101da sutta - Bases for Psychic Ability (Second)",
    description: "Developing the bases of psychic ability can lead to enlightenment in this very life or the state of non-returning.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, an, an5",
    id: "an5.68",
    path: "/an/an5/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "an5.68.pli": {
    title: "Pa\u1E6Dhamaiddhip\u0101da sutta - Bases for Psychic Ability (Second)",
    description: "Developing the bases of psychic ability can lead to enlightenment in this very life or the state of non-returning.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, mind, investigation, reflection, close examination, an, an5",
    id: "an5.68",
    path: "/an/an5/",
    updatedTime: "2024-08-02T14:53:24.000Z"
  },
  "an6.55.en": {
    title: "So\u1E47a sutta - To So\u1E47a",
    description: "The Buddha advises So\u1E47a on the importance of balanced energy and breaking through to a balanced state of the faculties with the example of the lute strings.",
    fetter: "doubt",
    tags: "balance,balanced energy,seclusion,renunciation,non-ill will,non-craving,non-clinging,non-delusion,arahant,impermanence",
    id: "an6.55",
    path: "/an/an6/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "an6.55.pli": {
    title: "So\u1E47a sutta - To So\u1E47a",
    description: "The Buddha advises So\u1E47a on the importance of balanced energy and breaking through to a balanced state of the faculties with the example of the lute strings.",
    fetter: "doubt",
    tags: "balance,balanced energy,seclusion,renunciation,non-ill will,non-craving,non-clinging,non-delusion,arahant,impermanence",
    id: "an6.55",
    path: "/an/an6/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an6.63.en": {
    title: "Nibbedhika sutta - Penetrating",
    description: "The Buddha shares a penetrative dhamma exposition on sensual pleasures, feelings, perceptions, taints, actions, and suffering.",
    fetter: "ignorance,sensual desire",
    tags: "sensual pleasures,feelings,perceptions,taints,actions,kamma,suffering,ignorance,sensual desire",
    id: "an6.63",
    path: "/an/an6/",
    updatedTime: "2024-08-07T12:46:18.000Z"
  },
  "an6.63.pli": {
    title: "Nibbedhika sutta - Penetrating",
    description: "The Buddha shares a penetrative dhamma exposition on sensual pleasures, feelings, perceptions, taints, actions, and suffering.",
    fetter: "ignorance,sensual desire",
    tags: "sensual pleasures,feelings,perceptions,taints,actions,kamma,suffering,ignorance,sensual desire",
    id: "an6.63",
    path: "/an/an6/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an6.64.en": {
    title: "S\u012Bhan\u0101da sutta - Lion's Roar",
    description: "The Buddha explains the six powers of a Tath\u0101gata that are accessible to one with collectedness.",
    fetter: "ignorance",
    tags: "tath\u0101gata, collectedness, powers, an, an6",
    id: "an6.64",
    path: "/an/an6/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "an6.64.pli": {
    title: "S\u012Bhan\u0101da sutta - Lion's Roar",
    description: "The Buddha explains the six powers of a Tath\u0101gata and the importance of collectedness.",
    fetter: "ignorance",
    tags: "tath\u0101gata, collectedness, powers, an, an6",
    id: "an6.64",
    path: "/an/an6/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an6.73.en": {
    title: "Pa\u1E6Dhamatajjh\u0101na sutta - First Jh\u0101na (First)",
    description: "Six qualities to abandon to dwell in the first jh\u0101na - 1) sensual desire, 2) ill-will, 3) complacency, 4) restlessness, 5) doubt, 6) failure to clearly see the true danger in sensual pleasures with correct wisdom.",
    fetter: "doubt,adherence to rites and rituals,ill-will,sensual desire",
    tags: "jhana,an,an6,first jhana,sensual desire,ill-will,complacency,restlessness,doubt",
    id: "an6.73",
    path: "/an/an6/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an6.73.pli": {
    title: "Pa\u1E6Dhamatajjh\u0101na sutta - First Jh\u0101na (First)",
    description: "Six qualities to abandon to dwell in the first jh\u0101na - 1) sensual desire, 2) ill-will, 3) complacency, 4) restlessness, 5) doubt, 6) failure to clearly see the true danger in sensual pleasures with correct wisdom.",
    fetter: "doubt,adherence to rites and rituals,ill-will,sensual desire",
    tags: "jhana,an,an6,first jhana,sensual desire,ill-will,complacency,restlessness,doubt",
    id: "an6.73",
    path: "/an/an6/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an6.74.en": {
    title: "Dutiyatajjh\u0101na sutta - First Jh\u0101na (Second)",
    description: "Six qualities to abandon to dwell in the first jh\u0101na - 1) thoughts of sensual desire, 2) thoughts of ill-will, 3) thoughts of harm, 4) perception of sensual desire, 5) perception of ill-will, 6) perception of harm.",
    fetter: "doubt,adherence to rites and rituals,ill-will,sensual desire",
    tags: "jhana,an,an6,first jhana,sensual desire,ill-will,harm",
    id: "an6.74",
    path: "/an/an6/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an6.74.pli": {
    title: "Dutiyatajjh\u0101na sutta - First Jh\u0101na (Second)",
    description: "Six qualities to abandon to dwell in the first jh\u0101na - 1) thoughts of sensual desire, 2) thoughts of ill-will, 3) thoughts of harm, 4) perception of sensual desire, 5) perception of ill-will, 6) perception of harm.",
    fetter: "doubt,adherence to rites and rituals,ill-will,sensual desire",
    tags: "jhana,an,an6,first jhana,sensual desire,ill-will,harm",
    id: "an6.74",
    path: "/an/an6/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an6.75.en": {
    title: "Dukkha sutta - Suffering",
    description: "Six qualities to dwell in ease, without distress, without anguish - 1) thoughts of relinquishment, 2) non-ill-will, 3) non-harming, 4) perceptions of relinquishment, 5) non-ill will, 6) non-harming.",
    fetter: "ill-will,sensual desire,doubt",
    tags: "an,an6,suffering,ill-will,sensual desire,doubt,relinquishment,non-ill-will,non-harming",
    id: "an6.75",
    path: "/an/an6/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an6.75.pli": {
    title: "Dukkha sutta - Suffering",
    description: "Six qualities to dwell in ease, without distress, without anguish - 1) thoughts of relinquishment, 2) non-ill-will, 3) non-harming, 4) perceptions of relinquishment, 5) non-ill will, 6) non-harming.",
    fetter: "ill-will,sensual desire,doubt",
    tags: "an,an6,suffering,ill-will,sensual desire,doubt,relinquishment,non-ill-will,non-harming",
    id: "an6.75",
    path: "/an/an6/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an7.28.en": {
    title: "Pa\u1E6Dhamaparih\u0101ni sutta - Decline (First)",
    description: "The Buddha explains seven things that lead to the decline of a trainee bhikkhu and seven things that do not.",
    fetter: "doubt, adherence to rites and rituals",
    tags: "an,an7",
    id: "an7.28",
    path: "/an/an7/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an7.28.pli": {
    title: "Pa\u1E6Dhamaparih\u0101ni sutta - Decline (First)",
    description: "The Buddha explains seven things that lead to the decline of a trainee bhikkhu and seven things that do not.",
    fetter: "doubt, adherence to rites and rituals",
    tags: "an,an7",
    id: "an7.28",
    path: "/an/an7/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "an7.53.en": {
    title: "Nandam\u0101t\u0101 sutta - Nanda's Mother",
    description: "The seven wonderful and marvelous qualities of Nandam\u0101t\u0101, a female lay follower.",
    fetter: "doubt",
    tags: "five lower fetters, great king Vessava\u1E47a, Nandam\u0101t\u0101, S\u0101riputta, Moggall\u0101na, jhana, an, an7",
    id: "an7.53",
    path: "/an/an7/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "an7.53.pli": {
    title: "Nandam\u0101t\u0101 sutta - Nanda's Mother",
    description: "The seven wonderful and marvelous qualities of Nandam\u0101t\u0101, a female lay follower.",
    fetter: "doubt",
    tags: "five lower fetters, great king Vessava\u1E47a, Nandam\u0101t\u0101, S\u0101riputta, Moggall\u0101na, jhana, an, an7",
    id: "an7.53",
    path: "/an/an7/",
    updatedTime: "2024-08-23T02:33:52.000Z"
  },
  "an8.21.en": {
    title: "Pa\u1E6Dhamaugga sutta - With Ugga of Ves\u0101l\u012B",
    description: "Ugga, the householder of Ves\u0101l\u012B is endowed with eight wonderful and marvelous qualities.",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, fame, an, an8",
    id: "an8.21",
    path: "/an/an8/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "an8.21.pli": {
    title: "Pa\u1E6Dhamaugga sutta - With Ugga of Ves\u0101l\u012B",
    description: "Ugga, the householder of Ves\u0101l\u012B is endowed with eight wonderful and marvelous qualities.",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, fame, an, an8",
    id: "an8.21",
    path: "/an/an8/",
    updatedTime: "2024-08-15T10:12:20.000Z"
  },
  "an8.22.en": {
    title: "Dutiyaugga sutta - With Ugga of Hatthig\u0101ma",
    description: "Ugga, the householder of Hatthig\u0101ma is endowed with eight wonderful and marvelous qualities. The 6th quality is different from AN 8.21.",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, fame, an, an8",
    id: "an8.22",
    path: "/an/an8/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "an8.22.pli": {
    title: "Dutiyaugga sutta - With Ugga of Hatthig\u0101ma",
    description: "Ugga, the householder of Hatthig\u0101ma is endowed with eight wonderful and marvelous qualities. The 6th quality is different from AN 8.21.",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, fame, an, an8",
    id: "an8.22",
    path: "/an/an8/",
    updatedTime: "2024-08-15T10:12:20.000Z"
  },
  "an8.53.en": {
    title: "Sa\u1E45khitta sutta - Brief",
    description: "The Buddha advises Mah\u0101paj\u0101pat\u012B Gotam\u012B to abandon teachings that lead to passion, being bound, accumulating, wanting more, discontentment, company, laziness, and being burdensome. Instead, embrace teachings that lead to dispassion, being unbound, shedding, wanting less, contentment, solitude, the arousal of energy, and being unburdensome.",
    fetter: "doubt",
    tags: "an,an8,passion,dispassion,accumulating,shedding,wanting more,wanting less,discontentment,contentment,company,solitude,laziness,arousal of energy,burdensome,unburdensome",
    id: "an8.53",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.53.pli": {
    title: "Sa\u1E45khitta sutta - Brief",
    description: "The Buddha advises Mah\u0101paj\u0101pat\u012B Gotam\u012B to abandon teachings that lead to passion, being bound, accumulating, wanting more, discontentment, company, laziness, and being burdensome. Instead, embrace teachings that lead to dispassion, being unbound, shedding, wanting less, contentment, solitude, the arousal of energy, and being unburdensome.",
    fetter: "doubt",
    tags: "an,an8,passion,dispassion,accumulating,shedding,wanting more,wanting less,discontentment,contentment,company,solitude,laziness,arousal of energy,burdensome,unburdensome",
    id: "an8.53",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.54.en": {
    title: "D\u012Bghaj\u0101\u1E47u sutta - With A Koliyan Man",
    description: "The Buddha explains the four qualities that lead to the benefit and happiness in this life and in the future life.",
    fetter: "ignorance",
    tags: "virtue, learning, wisdom, praise, criticism, an, an8",
    id: "an8.54",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.54.pli": {
    title: "D\u012Bghaj\u0101\u1E47u sutta - With A Koliyan Man",
    description: "The Buddha explains the four qualities that lead to the benefit and happiness in this life and in the future life.",
    fetter: "ignorance",
    tags: "virtue, learning, wisdom, praise, criticism, an, an8",
    id: "an8.54",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.59.en": {
    title: "Pa\u1E6Dhamapuggala sutta - Eight People (First)",
    description: "The eight people who are worthy of offerings, hospitality, gifts, and reverential salutation, and are the supreme field of merit for the world.",
    fetter: "doubt, adherence to rites and rituals",
    tags: "stream-enterer, once-returner, non-returner, arahant, merit, an, an8",
    id: "an8.59",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.59.pli": {
    title: "Pa\u1E6Dhamapuggala sutta - Eight People (First)",
    description: "The eight people who are worthy of offerings, hospitality, gifts, and reverential salutation, and are the supreme field of merit for the world.",
    fetter: "doubt, adherence to rites and rituals",
    tags: "stream-enterer, once-returner, non-returner, arahant, merit, an, an8",
    id: "an8.59",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.7.en": {
    title: "Devadattavipatti sutta - Devadatta's Misfortune",
    description: "The Buddha advises the bhikkhus to review their own failings and the failings of others, and to overcome acquisitions, loss, fame, disrepute, honor, dishonor, evil wishes, and evil friendship.",
    fetter: "ill-will,sensual desire,doubt",
    tags: "an,an8,acquisitions,loss,fame,disrepute,honor,dishonor,evil wishes,evil friendship",
    id: "an8.7",
    path: "/an/an8/",
    updatedTime: "2024-08-02T15:10:27.000Z"
  },
  "an8.7.pli": {
    title: "Devadattavipatti sutta - Devadatta's Misfortune",
    description: "The Buddha advises the bhikkhus to review their own failings and the failings of others, and to overcome acquisitions, loss, fame, disrepute, honor, dishonor, evil wishes, and evil friendship.",
    fetter: "ill-will,sensual desire,doubt",
    tags: "an,an8,acquisitions,loss,fame,disrepute,honor,dishonor,evil wishes,evil friendship",
    id: "an8.7",
    path: "/an/an8/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an8.80.en": {
    title: "Kus\u012Bt\u0101rambhavatthu sutta - Grounds for Laziness and Arousing Energy",
    description: "The Buddha explains the eight grounds for laziness and the eight grounds for arousing energy.",
    fetter: "doubt, adherence to rites and rituals, sensual desire, ill-will",
    tags: "laziness, energy, effort, diligence, an, an8",
    id: "an8.80",
    path: "/an/an8/",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an8.80.pli": {
    title: "Kus\u012Bt\u0101rambhavatthu sutta - Grounds for Laziness and Arousing Energy",
    description: "The Buddha explains the eight grounds of laziness and the eight grounds for arousing energy.",
    fetter: "doubt, adherence to rites and rituals, sensual desire, ill-will",
    tags: "laziness, energy, effort, diligence, an, an8",
    id: "an8.80",
    path: "/an/an8/",
    updatedTime: "2024-08-16T05:05:35.000Z"
  },
  "an9.25.en": {
    title: "Pa\xF1\xF1\u0101 sutta - Wisdom",
    description: "Nine reflections by which a Bhikkhu can know that their mind is thoroughly cultivated with wisdom.",
    fetter: "ignorance",
    tags: "wisdom, ignorance, passion, aversion, delusion, sensual existence, form existence, formless existence, an, an9",
    id: "an9.25",
    path: "/an/an9/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an9.25.pli": {
    title: "Pa\xF1\xF1\u0101 sutta - Wisdom",
    description: "Nine reflections by which a Bhikkhu can know that their mind is thoroughly cultivated with wisdom.",
    fetter: "ignorance",
    tags: "wisdom, ignorance, passion, aversion, delusion, sensual existence, form existence, formless existence, an, an9",
    id: "an9.25",
    path: "/an/an9/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an9.26.en": {
    title: "Sil\u0101y\u016Bpa sutta - Stone Pillar",
    description: "Venerable S\u0101riputta clarifies on a teaching on how liberation is to be verified. He shares a simile of the stone pillar.",
    fetter: "ignorance",
    tags: "passion, aversion, delusion, sense realm, form realm, formless realm, an, an9",
    id: "an9.26",
    path: "/an/an9/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an9.26.pli": {
    title: "Sil\u0101y\u016Bpa sutta - Stone Pillar",
    description: "Venerable S\u0101riputta clarifies on a teaching on how liberation is to be verified. He shares a simile of the stone pillar.",
    fetter: "ignorance",
    tags: "passion, aversion, delusion, sense realm, form realm, formless realm, an, an9",
    id: "an9.26",
    path: "/an/an9/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "an9.7.en": {
    title: "Sutav\u0101 sutta - To Sutav\u0101",
    description: "The Buddha explains to Sutav\u0101, the wanderer, that an arahant is incapable of transgressing in nine ways.",
    fetter: "doubt",
    tags: "arahant, transgression, killing, stealing, sexual misconduct, lying, using stored-up goods, impulse, aversion, delusion, fear, an, an9",
    id: "an9.7",
    path: "/an/an9/",
    updatedTime: "2024-07-28T12:01:29.000Z"
  },
  "an9.7.pli": {
    title: "Sutav\u0101 sutta - To Sutav\u0101",
    description: "The Buddha explains to Sutav\u0101, the wanderer, that an arahant is incapable of transgressing in nine ways.",
    fetter: "doubt",
    tags: "arahant, transgression, killing, stealing, sexual misconduct, lying, using stored-up goods, impulse, aversion, delusion, fear, an, an9",
    id: "an9.7",
    path: "/an/an9/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "dhp1-20.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp1.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#1",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp2.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#2",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp3.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#3",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp4.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#4",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp5.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#5",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp6.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#6",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp7.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#7",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp8.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#8",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp9.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#9",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp10.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#10",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp11.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#11",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp12.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#12",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp13.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#13",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp14.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#14",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp15.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#15",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp16.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#16",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp17.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#17",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp18.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#18",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp19.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#19",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp20.en": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.en#20",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp1-20.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp1.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#1",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp2.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#2",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp3.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#3",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp4.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#4",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp5.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#5",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp6.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#6",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp7.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#7",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp8.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#8",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp9.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#9",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp10.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#10",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp11.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#11",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp12.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#12",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp13.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#13",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp14.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#14",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp15.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#15",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp16.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#16",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp17.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#17",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp18.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#18",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp19.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#19",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp20.pli": {
    title: "Yamakavagga - Chapter 1 - Pairs",
    description: "DhammaPada Verses 1 - 20 cover the topic of the mind and the importance of guarding it. The mind is compared to a poorly covered house, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    tags: "dhp1-20,mind,resentment,hate,death,essential,sensual desire,ill-will,passion,delusion",
    fetter: "ignorance,ill-will,sensual desire,conceit",
    id: "dhp1-20",
    path: "/dhp/",
    fullPath: "/dhp/dhp1-20.pli#20",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp21-32.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp21.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#21",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp22.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#22",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp23.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#23",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp24.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#24",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp25.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#25",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp26.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#26",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp27.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#27",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp28.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#28",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp29.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#29",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp30.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#30",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp31.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#31",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp32.en": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.en#32",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp21-32.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp21.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#21",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp22.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#22",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp23.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#23",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp24.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#24",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp25.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#25",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp26.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#26",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp27.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#27",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp28.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#28",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp29.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#29",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp30.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#30",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp31.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#31",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp32.pli": {
    title: "Appam\u0101davagga - Chapter 2 - Heedfulness",
    description: "DhammaPada Verses 21 - 32 cover the topic of heedfulness and the importance of being diligent and wise. The wise one is encouraged to guard against heedlessness and to cultivate heedfulness as a path to liberation.",
    tags: "heedfulness,heedlessness,death,liberation,diligence,wisdom,nibb\u0101na,meditation",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    id: "dhp21-32",
    path: "/dhp/",
    fullPath: "/dhp/dhp21-32.pli#32",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "dhp33-43.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp33.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#33",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp34.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#34",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp35.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#35",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp36.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#36",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp37.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#37",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp38.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#38",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp39.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#39",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp40.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#40",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp41.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#41",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp42.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#42",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp43.en": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.en#43",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp33-43.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp33.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#33",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp34.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#34",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp35.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#35",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp36.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#36",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp37.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#37",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp38.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#38",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp39.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#39",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp40.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#40",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp41.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#41",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp42.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#42",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp43.pli": {
    title: "Citta vagga - Chapter 3 - Mind",
    description: "DhammaPada Verses 33 - 43 cover the topic of the mind and the importance of guarding it. The mind is compared to a fish out of water, and the wise one is encouraged to guard the mind to avoid falling into M\u0101ra's realm.",
    fetter: "ignorance, doubt, sensual desire, restlessness and worry",
    tags: "dhp, mind, sensual desire, ill-will, mara, passion, delusion,  doubt, restlessness, worry, dhp33-43",
    id: "dhp33-43",
    path: "/dhp/",
    fullPath: "/dhp/dhp33-43.pli#43",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp44-59.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp44.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#44",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp45.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#45",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp46.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#46",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp47.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#47",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp48.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#48",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp49.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#49",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp50.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#50",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp51.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#51",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp52.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#52",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp53.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#53",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp54.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#54",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp55.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#55",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp56.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#56",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp57.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#57",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp58.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#58",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp59.en": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.en#59",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp44-59.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp44.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#44",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp45.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#45",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp46.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#46",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp47.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#47",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp48.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#48",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp49.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#49",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp50.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#50",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp51.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#51",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp52.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#52",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp53.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#53",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp54.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#54",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp55.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#55",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp56.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#56",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp57.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#57",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp58.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#58",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp59.pli": {
    title: "Puppha vagga - Chapter 4 - Flowers",
    description: "DhammaPada Verses 44 - 59 cover the topic of virtue and wisdom. The fragrance of virtue is compared to the fragrance of flowers, and the virtue of the noble person is said to spread in all directions.",
    fetter: "ignorance",
    tags: "dhp, flowers, virtue, fragrance, virtue, wisdom, dhp44-59",
    id: "dhp44-59",
    path: "/dhp/",
    fullPath: "/dhp/dhp44-59.pli#59",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp60-75.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp60.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#60",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp61.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#61",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp62.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#62",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp63.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#63",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp64.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#64",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp65.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#65",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp66.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#66",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp67.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#67",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp68.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#68",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp69.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#69",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp70.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#70",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp71.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#71",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp72.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#72",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp73.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#73",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp74.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#74",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp75.en": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.en#75",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp60-75.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp60.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#60",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp61.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#61",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp62.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#62",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp63.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#63",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp64.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#64",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp65.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#65",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp66.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#66",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp67.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#67",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp68.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#68",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp69.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#69",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp70.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#70",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp71.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#71",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp72.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#72",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp73.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#73",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp74.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#74",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp75.pli": {
    title: "B\u0101la vagga - Chapter 5 - Immature",
    description: "DhammaPada Verses 60 - 75 cover the topic of immaturity and the consequences of ignorance. The immature person is likened to a child who does not understand the true Dhamma.",
    fetter: "ignorance",
    tags: "immature, ignorance, evil deed, wise, dhp, dhp60-75",
    id: "dhp60-75",
    path: "/dhp/",
    fullPath: "/dhp/dhp60-75.pli#75",
    updatedTime: "2024-08-24T09:18:24.000Z"
  },
  "dhp76-89.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp76.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#76",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp77.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#77",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp78.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#78",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp79.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#79",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp80.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#80",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp81.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#81",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp82.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#82",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp83.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#83",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp84.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#84",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp85.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#85",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp86.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#86",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp87.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#87",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp88.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#88",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp89.en": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.en#89",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "dhp76-89.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp76.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#76",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp77.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#77",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp78.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#78",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp79.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#79",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp80.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#80",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp81.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#81",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp82.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#82",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp83.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#83",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp84.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#84",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp85.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#85",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp86.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#86",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp87.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#87",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp88.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#88",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp89.pli": {
    title: "Pa\u1E47\u1E0Dita vagga - The Chapter On The Sage",
    description: "DhammaPada Verses 76-89 cover the topic of associating with a wise person, characteristics of such a person, the importance of joy in the Dhamma, the benefits of renunciation, and the qualities of a well-developed mind.",
    fetter: "ignorance",
    tags: "wise, friends, joy, renunciation, well-developed mind, dhp, dhp76-89",
    id: "dhp76-89",
    path: "/dhp/",
    fullPath: "/dhp/dhp76-89.pli#89",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp90-99.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp90.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#90",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp91.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#91",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp92.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#92",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp93.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#93",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp94.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#94",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp95.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#95",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp96.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#96",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp97.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#97",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp98.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#98",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp99.en": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.en#99",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp90-99.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp90.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#90",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp91.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#91",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp92.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#92",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp93.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#93",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp94.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#94",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp95.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#95",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp96.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#96",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp97.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#97",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp98.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#98",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "dhp99.pli": {
    title: "Arahanta vagga - The Chapter On The Awakened Being",
    description: "Dhammapada Verses 90-99 describe the characteristics of an awakened being, the qualities of a peaceful mind, and what makes a place pleasing.",
    fetter: "ignorance",
    tags: "awakened, seclusion, tranquility, peaceful, dhp, dhp90-99",
    id: "dhp90-99",
    path: "/dhp/",
    fullPath: "/dhp/dhp90-99.pli#99",
    updatedTime: "2024-09-14T14:54:09.000Z"
  },
  "index.en": {
    title: "The Words of the Buddha",
    description: "The Words of the Buddha project aims to restore the Buddha's teachings by faithfully translating the P\u0101li Canon and preserve them by making these translations accessible to a global audience, and offering learning opportunities and support for practitioners dedicated to learning, practicing and sharing the teachings of the Buddha.",
    tags: "introduction,buddha,words,wisdom,translation,roadmap,project",
    fetter: "ignorance",
    id: "index",
    path: "//",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "index.pli": {
    title: "The Words of the Buddha",
    description: "The Words of the Buddha project aims to restore the Buddha's teachings by faithfully translating the P\u0101li Canon and preserve them by making these translations accessible to a global audience, and offering learning opportunities and support for practitioners dedicated to learning, practicing and sharing the teachings of the Buddha.",
    tags: "introduction,buddha,words,wisdom,translation,roadmap,project",
    fetter: "ignorance",
    id: "index",
    path: "//",
    updatedTime: "2024-07-20T10:23:29.000Z"
  },
  "iti1.en": {
    title: "Lobha sutta - Greed",
    description: "The Buddha describes the abandoning of greed as the guarantee for non-returning.",
    fetter: "sensual desire",
    tags: "greed, non-returning, iti, sensual desire",
    id: "iti1",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti1.pli": {
    title: "Lobha sutta - Greed",
    description: "The Buddha describes the abandoning of greed as the guarantee for non-returning.",
    fetter: "sensual desire",
    tags: "greed, non-returning, iti, sensual desire",
    id: "iti1",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti10.en": {
    title: "Dosapari\xF1\xF1\u0101 sutta - Completely Comprehending Aversion",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending aversion, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending aversion, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will, hate",
    tags: "suffering, aversion, ill-will, hate, wisdom, detachment, abandoning, iti",
    id: "iti10",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti10.pli": {
    title: "Dosapari\xF1\xF1\u0101 sutta - Completely Comprehending Aversion",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending aversion, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending aversion, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will, hate",
    tags: "suffering, aversion, ill-will, hate, wisdom, detachment, abandoning, iti",
    id: "iti10",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti11.en": {
    title: "Mohapari\xF1\xF1\u0101 sutta - Completely Comprehending Delusion",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending delusion, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending delusion, with the mind detaching from it, and by abandoning it.",
    fetter: "ignorance, delusion",
    tags: "suffering, ignorance, delusion, wisdom, detachment, abandoning, iti",
    id: "iti11",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti11.pli": {
    title: "Mohapari\xF1\xF1\u0101 sutta - Completely Comprehending Delusion",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending delusion, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending delusion, with the mind detaching from it, and by abandoning it.",
    fetter: "ignorance, delusion",
    tags: "suffering, ignorance, delusion, wisdom, detachment, abandoning, iti",
    id: "iti11",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti12.en": {
    title: "Kodhapari\xF1\xF1\u0101 sutta - Completely Comprehending Anger",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending anger, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending anger, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will",
    tags: "suffering, anger, ill-will, wisdom, detachment, abandoning, iti",
    id: "iti12",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti12.pli": {
    title: "Kodhapari\xF1\xF1\u0101 sutta - Completely Comprehending Anger",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending anger, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending anger, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will",
    tags: "suffering, anger, ill-will, wisdom, detachment, abandoning, iti",
    id: "iti12",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti13.en": {
    title: "Makkhapari\xF1\xF1\u0101 sutta - Completely Comprehending Contempt",
    description: "One is incapable of ending suffering without directly knowing, not fully comprehending contempt, with the mind not detaching from it, and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending contempt, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will",
    tags: "suffering, contempt, ungratefulness, wisdom, detachment, abandoning, iti",
    id: "iti13",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti13.pli": {
    title: "Makkhapari\xF1\xF1\u0101 sutta - Completely Comprehending Contempt",
    description: "One is incapable of ending suffering without directly knowing, not fully comprehending contempt, with the mind not detaching from it, and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending contempt, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will",
    tags: "suffering, contempt, ungratefulness, wisdom, detachment, abandoning, iti",
    id: "iti13",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti14.en": {
    title: "Avijj\u0101n\u012Bvara\u1E47a sutta - Barrier Of Ignorance",
    description: "The Blessed One explains the barrier of ignorance as surpassing all other barriers, causing beings to transmigrate through repeated existence for a long time.",
    fetter: "ignorance",
    tags: "ignorance, delusion, illusion, misperception, distorted view, iti",
    id: "iti14",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti14.pli": {
    title: "Avijj\u0101n\u012Bvara\u1E47a sutta - Barrier Of Ignorance",
    description: "The Blessed One explains the barrier of ignorance as surpassing all other barriers, causing beings to transmigrate through repeated existence for a long time.",
    fetter: "ignorance",
    tags: "ignorance, delusion, illusion, misperception, distorted view, iti",
    id: "iti14",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti15.en": {
    title: "Ta\u1E47h\u0101sa\u1E41yojana sutta - Fettered By Craving",
    description: "The Buddha describes craving as the single fetter by which beings are bound that causes them to wander and transmigrate for a long time.",
    fetter: "sensual desire",
    tags: "craving, suffering, transmigration, iti",
    id: "iti15",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti15.pli": {
    title: "Ta\u1E47h\u0101sa\u1E41yojana sutta - Fettered By Craving",
    description: "The Buddha describes craving as the single fetter by which beings are bound that causes them to wander and transmigrate for a long time.",
    fetter: "sensual desire",
    tags: "craving, suffering, transmigration, iti",
    id: "iti15",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti16.en": {
    title: "Pa\u1E6Dhamasekha sutta - Trainee (First)",
    description: "The Buddha shares on the importance of wise attention for a trainee bhikkhu.",
    fetter: "doubt,personal existence,adherence to rites and rituals",
    tags: "iti,trainee,wholesome,unwholesome,wise attention,yoniso manasik\u0101ra",
    id: "iti16",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti16.pli": {
    title: "Pa\u1E6Dhamasekha sutta - Trainee (First)",
    description: "The Buddha shares on the importance of wise attention and careful attending for a trainee bhikkhu.",
    fetter: "doubt,personal existence,adherence to rites and rituals",
    tags: "iti,trainee,wholesome,unwholesome,wise attention,yoniso manasik\u0101ra",
    id: "iti16",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti17.en": {
    title: "Dutiyasekha sutta - Trainee (Second)",
    description: "The Buddha shares on the importance of good friendship for a trainee bhikkhu.",
    fetter: "doubt,personal existence,adherence to rites and rituals",
    tags: "iti,trainee,wholesome,unwholesome,good friendship,kaly\u0101\u1E47a mittat\u0101",
    id: "iti17",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti17.pli": {
    title: "Dutiyasekha sutta - Trainee (Second)",
    description: "The Buddha shares on the importance of good friendship for a trainee bhikkhu.",
    fetter: "doubt,personal existence,adherence to rites and rituals",
    tags: "iti,trainee,wholesome,unwholesome,good friendship,kaly\u0101\u1E47a mittat\u0101",
    id: "iti17",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti2.en": {
    title: "Dosa sutta - Aversion",
    description: "The Buddha describes the abandoning of aversion as the guarantee for non-returning.",
    fetter: "ill-will",
    tags: "aversion, non-returning, iti, ill-will",
    id: "iti2",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti2.pli": {
    title: "Dosapari\xF1\xF1\u0101 sutta - Completely Comprehending Aversion",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending aversion, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending aversion, with the mind detaching from it, and by abandoning it.",
    fetter: "ill-will, hate",
    tags: "suffering, aversion, ill-will, hate, wisdom, detachment, abandoning, iti",
    id: "iti10",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti3.en": {
    title: "Moha sutta - Delusion",
    description: "The Buddha describes the abandoning of delusion as the guarantee for non-returning.",
    fetter: "ignorance",
    tags: "delusion,ignorance,iti, non-returning",
    id: "iti3",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti3.pli": {
    title: "Moha sutta - Delusion",
    description: "The Buddha describes the abandoning of delusion as the guarantee for non-returning.",
    fetter: "ignorance",
    tags: "delusion,ignorance,iti, non-returning",
    id: "iti3",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti4.en": {
    title: "Kodha sutta - Anger",
    description: "The Buddha describes the abandoning of anger as the guarantee for non-returning.",
    fetter: "ill-will",
    tags: "anger,ill-will,aversion,iti, non-returning",
    id: "iti4",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti4.pli": {
    title: "Kodha sutta - Anger",
    description: "The Buddha describes the abandoning of anger as the guarantee for non-returning.",
    fetter: "ill-will",
    tags: "anger,ill-will,aversion,iti, non-returning",
    id: "iti4",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti5.en": {
    title: "Makkha sutta - Contempt",
    description: "The Buddha describes the abandoning of contempt as the guarantee for non-returning.",
    fetter: "ill-will",
    tags: "contempt, ungratefulness, non-returning, iti, ill-will",
    id: "iti5",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti5.pli": {
    title: "Makkha sutta - Contempt",
    description: "The Buddha describes the abandoning of contempt as the guarantee for non-returning.",
    fetter: "ill-will",
    tags: "contempt, ungratefulness, non-returning, iti, ill-will",
    id: "iti5",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti6.en": {
    title: "M\u0101na sutta - Conceit",
    description: "The Buddha describes the abandoning of conceit as the guarantee for non-returning.",
    fetter: "conceit",
    tags: "conceit, non-returning, iti, pride",
    id: "iti6",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti6.pli": {
    title: "M\u0101na sutta - Conceit",
    description: "The Buddha describes the abandoning of conceit as the guarantee for non-returning.",
    fetter: "conceit",
    tags: "conceit, non-returning, iti, pride",
    id: "iti6",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti7.en": {
    title: "Sabbapari\xF1\xF1\u0101 sutta - Completely Understanding All",
    description: "One is incapable of ending suffering without directly knowing, not completely understanding the all, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully understanding the all, with the mind detaching from it, and by abandoning it.",
    fetter: "ignorance",
    tags: "suffering, ignorance, understanding, detachment, abandoning, iti",
    id: "iti7",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti7.pli": {
    title: "Sabbapari\xF1\xF1\u0101 sutta - Completely Understanding All",
    description: "One is incapable of ending suffering without directly knowing, not completely understanding the all, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully understanding the all, with the mind detaching from it, and by abandoning it.",
    fetter: "ignorance",
    tags: "suffering, ignorance, understanding, detachment, abandoning, iti",
    id: "iti7",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti8.en": {
    title: "M\u0101napari\xF1\xF1\u0101 sutta - Completely Understanding Conceit",
    description: "One is incapable of ending suffering without directly knowing, not completely understanding conceit, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully understanding conceit, with the mind detaching from it, and by abandoning it.",
    fetter: "conceit",
    tags: "suffering, conceit, understanding, detachment, abandoning, iti",
    id: "iti8",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti8.pli": {
    title: "M\u0101napari\xF1\xF1\u0101 sutta - Completely Understanding Conceit",
    description: "One is incapable of ending suffering without directly knowing, not completely understanding conceit, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully understanding conceit, with the mind detaching from it, and by abandoning it.",
    fetter: "conceit",
    tags: "suffering, conceit, understanding, detachment, abandoning, iti",
    id: "iti8",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti9.en": {
    title: "Lobhapari\xF1\xF1\u0101 sutta - Completely Comprehending Greed",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending greed, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending greed, with the mind detaching from it, and by abandoning it.",
    fetter: "sensual desire, greed",
    tags: "suffering, greed, wisdom, detachment, abandoning, iti",
    id: "iti9",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti9.pli": {
    title: "Lobhapari\xF1\xF1\u0101 sutta - Completely Comprehending Greed",
    description: "One is incapable of ending suffering without directly knowing, not completely comprehending greed, without the mind not detaching from it and without abandoning it. One is capable of ending suffering by directly knowing, by fully comprehending greed, with the mind detaching from it, and by abandoning it.",
    fetter: "sensual desire, greed",
    tags: "suffering, greed, wisdom, detachment, abandoning, iti",
    id: "iti9",
    path: "/iti/iti1-27/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti112.en": {
    title: "Loka sutta - World",
    description: "The Buddha explains why he is called the Tath\u0101gata, the one who has fully comprehended the world, its arising, cessation, and the path leading to its cessation.",
    fetter: "ignorance, doubt",
    tags: "tathagata, world, doubt, defilements, iti, four noble truths, ignorance, doubt",
    id: "iti112",
    path: "/iti/iti100-112/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti112.pli": {
    title: "Loka sutta - World",
    description: "The Buddha explains why he is called the Tath\u0101gata, the one who has fully comprehended the world, its arising, cessation, and the path leading to its cessation.",
    fetter: "ignorance, doubt",
    tags: "tathagata, world, doubt, defilements, iti, four noble truths, ignorance, doubt",
    id: "iti112",
    path: "/iti/iti100-112/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti28.en": {
    title: "Dukkhavih\u0101ra sutta - Discontented Abiding",
    description: "A person endowed with the two qualities of guarding the sense doors and moderation in eating lives with discontentedness in this very life and after death, a bad destination is expected.",
    fetter: "ignorance, sensual desire",
    tags: "suffering, guarding, sense bases, sense doors, moderation, eating, iti",
    id: "iti28",
    path: "/iti/iti28-49/",
    updatedTime: "2024-09-23T04:57:24.000Z"
  },
  "iti28.pli": {
    title: "Dukkhavih\u0101ra sutta - Discontented Abiding",
    description: "A bhikkhu endowed with the two qualities of guarding the sense doors and moderation in eating lives with discontentedness in this very life and after death, a bad destination is expected.",
    fetter: "ignorance, sensual desire",
    tags: "suffering, guarding, sense bases, sense doors, moderation, eating, iti",
    id: "iti28",
    path: "/iti/iti28-49/",
    updatedTime: "2024-09-23T04:57:24.000Z"
  },
  "iti29.en": {
    title: "Sukhavih\u0101ra sutta - Contented Abiding",
    description: "A person endowed with the two qualities of guarding the sense doors and moderation in eating lives happily in this very life and after death, a good destination is expected.",
    fetter: "ignorance, sensual desire",
    tags: "contentment, guarding, sense bases, sense doors, moderation, eating, happiness, ease, iti",
    id: "iti29",
    path: "/iti/iti28-49/",
    updatedTime: "2024-09-23T04:57:24.000Z"
  },
  "iti29.pli": {
    title: "Sukhavih\u0101ra sutta - Contented Abiding",
    description: "A bhikkhu endowed with the two qualities of guarding the sense faculties and moderation in eating lives happily in this very life and after death, a good destination is expected.",
    fetter: "ignorance",
    tags: "contentment, guarding, sense bases, sense faculties, moderation, eating, happiness, ease, iti",
    id: "iti29",
    path: "/iti/iti28-49/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti44.en": {
    title: "Nibb\u0101nadh\u0101tu sutta - The Nibb\u0101na Element",
    description: "The Buddha shares on the two Nibb\u0101na elements - 1.) with fuel remaining and 2.) without fuel remaining.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "iti,nibb\u0101na,wisdom,passion,aversion,delusion",
    id: "iti44",
    path: "/iti/iti28-49/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti44.pli": {
    title: "Nibb\u0101nadh\u0101tu sutta - The Nibb\u0101na Element",
    description: "The Buddha shares on the two Nibb\u0101na elements - 1.) with fuel remaining and 2.) without fuel remaining.",
    fetter: "sensual desire,ill-will,ignorance",
    tags: "iti,nibb\u0101na,wisdom,passion,aversion,delusion",
    id: "iti44",
    path: "/iti/iti28-49/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "iti50.en": {
    title: "M\u016Bla sutta - Roots [Of The Unwholesome]",
    description: "The Buddha lists the three roots of the unwholesome - greed, aversion, and delusion, and explain their effect on the mind with a simile.",
    fetter: "sensual desire, ill-will, ignorance",
    tags: "roots, unwholesome, greed, aversion, delusion, mind, simile, iti",
    id: "iti50",
    path: "/iti/iti50-99/",
    updatedTime: "2024-09-22T13:05:35.000Z"
  },
  "iti50.pli": {
    title: "M\u016Bla sutta - Roots [Of The Unwholesome]",
    description: "The Buddha lists the three roots of the unwholesome - greed, aversion, and delusion, and explain their effect on the mind with a simile.",
    fetter: "sensual desire, ill-will, ignorance",
    tags: "roots, unwholesome, greed, aversion, delusion, mind, simile, iti",
    id: "iti50",
    path: "/iti/iti50-99/",
    updatedTime: "2024-09-22T13:05:35.000Z"
  },
  "iti84.en": {
    title: "Bahujanahita sutta - The Welfare Of The Many",
    description: "The Buddha shares on the three kinds of persons who arise in the world for the welfare of the many - 1.) the Tath\u0101gata, 2.) the Arahant, and 3.) the trainee.",
    fetter: "ignorance",
    tags: "iti,nibb\u0101na,arahant,welfare,compassion,dhamma",
    id: "iti84",
    path: "/iti/iti50-99/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "iti84.pli": {
    title: "Bahujanahita sutta - The Welfare Of The Many",
    description: "The Buddha shares on the three kinds of persons who arise in the world for the welfare of the many - 1.) the Tath\u0101gata, 2.) the Arahant, and 3.) the trainee.",
    fetter: "ignorance",
    tags: "iti,nibb\u0101na,arahant,welfare,compassion,dhamma",
    id: "iti84",
    path: "/iti/iti50-99/",
    updatedTime: "2024-09-22T12:26:20.000Z"
  },
  "mn10.en": {
    title: "Establishing of Mindfulness",
    description: "In this teaching, the Buddha shares on establishing the four foundations of mindfulness - body, feelings, mind, and mental qualities. There are six choices for establishing mindfulness of body. There are five different types of mental qualities to be mindful of.",
    fetter: "doubt,identity view,sensual desire,conceit,ignorance",
    tags: "mn,mn1-10,mn1-50,impermanence,meditation,mindfulness,awareness,mindfulness of body,mindfulness of feelings,mindfulness of mind,mindfulness of mental qualities",
    id: "mn10",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn10.pli": {
    title: "Establishing of Mindfulness",
    description: "In this teaching, the Buddha shares on establishing the four foundations of mindfulness - body, feelings, mind, and mental qualities. There are six choices for establishing mindfulness of body. There are five different types of mental qualities to be mindful of.",
    fetter: "doubt,identity view,sensual desire,conceit,ignorance",
    tags: "mn,mn1-10,mn1-50,impermanence,meditation,mindfulness,awareness,mindfulness of body,mindfulness of feelings,mindfulness of mind,mindfulness of mental qualities",
    id: "mn10",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn12.en": {
    title: "Mah\u0101s\u012Bhan\u0101da sutta - The Greater Discourse on The Lion's Roar",
    description: "When a bhikkhu who has left the Dhamma and training is disparaging the Buddha's states as merely human and his teaching as  merely leading to the end of suffering, the Buddha counters that this is in fact praise and goes on to enumerate his various attainments.",
    fetter: "doubt",
    tags: "doubt,superhuman,attainments,tath\u0101gata,mn,mn1-50,mn11-20",
    id: "mn12",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn12.pli": {
    title: "Mah\u0101s\u012Bhan\u0101da sutta - The Greater Discourse on The Lion's Roar",
    description: "When a bhikkhu who has left the Dhamma and training is disparaging the Buddha's states as merely human and his teaching as  merely leading to the end of suffering, the Buddha counters that this is in fact praise and goes on to enumerate his various attainments.",
    fetter: "doubt",
    tags: "doubt,superhuman,attainments,tath\u0101gata,mn,mn1-50,mn11-20",
    id: "mn12",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn16.en": {
    title: "Cetokhila sutta - Barriers Of The Mind",
    description: "The Buddha explains the five barriers and five shackles of the mind that prevent a bhikkhu from coming to growth, increase, and fulfillment in his teaching and training.",
    fetter: "doubt, sensual desire, ill-will",
    tags: "mind, doubt, sensual desire, ill-will, hen, awakening, barrier, shackle, buddha, dhamma, sangha, training, sensual pleasure, body, forms, sleeping, sluggishness, god, mn, mn1-50",
    id: "mn16",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn16.pli": {
    title: "Cetokhila sutta - Barriers Of The Mind",
    description: "The Buddha explains the five barriers and five shackles of the mind that prevent a bhikkhu from coming to growth, increase, and fulfillment in his teaching and training.",
    fetter: "doubt, sensual desire, ill-will",
    tags: "mind, doubt, sensual desire, ill-will, hen, awakening, barrier, shackle, buddha, dhamma, sangha, training, sensual pleasure, body, forms, sleeping, sluggishness, god, mn, mn1-50",
    id: "mn16",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-13T05:03:45.000Z"
  },
  "mn17.en": {
    title: "Vanapattha sutta - Forest Retreat",
    description: "The Buddha teaches the bhikkhus how to reflect on a dependence that one is taking using the example of a suitable place to live - a forest retreat, a village, a market town, a city, a country. He concludes with an example of depending on a certain person.",
    fetter: "ignorance",
    tags: "dependence, forest, retreat, village, market town, city, country, ignorance, mindfulness, taints, supreme security, robes, alms-food, resting place, medicinal requisites, mn, mn1-50",
    id: "mn17",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn17.pli": {
    title: "Vanapattha sutta - Forest Retreat",
    description: "The Buddha teaches the bhikkhus how to reflect on a dependence that one is taking using the example of a suitable place to live - a forest retreat, a village, a market town, a city, a country. He concludes with an example of depending on a certain person.",
    fetter: "ignorance",
    tags: "dependence, forest, retreat, village, market town, city, country, ignorance, mindfulness, taints, supreme security, robes, alms-food, resting place, medicinal requisites, mn, mn1-50",
    id: "mn17",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-23T21:50:17.000Z"
  },
  "mn19.en": {
    title: "Dvedh\u0101vitakka sutta - The Two Kinds of Thoughts",
    description: "The Buddha explains how he divided his thoughts into two kinds - 1) thoughts of sensuality, ill-will, and harm; and 2) thoughts of relinquishment, non-ill-will, and non-harm. He explains how he abandoned harmful thoughts and cultivated wholesome thoughts, leading to the attainment of the four jh\u0101nas and the three knowledges.",
    tags: "thoughts,sensual desire,ill-will,harm,relinquishment,good-will,non-harm,loving-kindness,compassion,wholesome,unwholesome,jh\u0101na,divine eye,recollection,liberation,mn,mn1-50,mn11-20,way of practice,right intention",
    fetter: "doubt",
    id: "mn19",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn19.pli": {
    title: "Dvedh\u0101vitakka sutta - The Two Kinds of Thoughts",
    description: "The Buddha explains how he divided his thoughts into two kinds - 1) thoughts of sensuality, ill-will, and harm; and 2) thoughts of relinquishment, non-ill-will, and non-harm. He explains how he abandoned harmful thoughts and cultivated wholesome thoughts, leading to the attainment of the four jh\u0101nas and the three knowledges.",
    tags: "thoughts,sensual desire,ill-will,harm,relinquishment,good-will,non-harm,loving-kindness,compassion,wholesome,unwholesome,jh\u0101na,divine eye,recollection,liberation,mn,mn1-50,mn11-20,way of practice,right intention",
    fetter: "doubt",
    id: "mn19",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn20.en": {
    title: "Vitakkasa\u1E47\u1E6Dh\u0101na sutta - Shaping Of Thoughts",
    description: "The Buddha explains how to cultivate the higher mind through similes whenever a harmful or unwholesome thought associated with desire, aversion, or delusion arises. Applying these five methods in a gradual sequence leads to abandoning of unwholesome thoughts, and to steadiness, calming, unification and collectedness of the mind.",
    fetter: "ignorance",
    tags: "higher mind, meditation, mental development, higher consciousness, shaping of thoughts, simile, mn, mn1-50",
    id: "mn20",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-23T04:57:55.000Z"
  },
  "mn20.pli": {
    title: "Vitakkasa\u1E47\u1E6Dh\u0101na sutta - Shaping Of Thoughts",
    description: "The Buddha explains how to cultivate the higher mind through similes whenever a harmful or unwholesome thought associated with desire, aversion, or delusion arises. Applying these five methods in a gradual sequence leads to abandoning of unwholesome thoughts, and to steadiness, calming, unification and collectedness of the mind.",
    fetter: "ignorance",
    tags: "higher mind, meditation, mental development, higher consciousness, shaping of thoughts, simile, mn, mn1-50",
    id: "mn20",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-23T04:57:55.000Z"
  },
  "mn22.en": {
    title: "Alagadd\u016Bpama sutta - Simile of the Water Snake",
    description: "The Buddha teaches about the harmful view of practicing while engaging in obstructions, and the simile of the water snake. The Buddha also teaches about the raft simile, the six views, and the abandoning of what is not yours.",
    fetter: "ignorance",
    tags: "mn,mn1-50,mn21-30,sensual desire,views,obstructions,raft,water snake,form,feeling,perception,formations,consciousness,not-self,disenchantment,dispassion,liberation",
    id: "mn22",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn22.pli": {
    title: "Alagadd\u016Bpama sutta - Simile of the Water Snake",
    description: "The Buddha teaches about the harmful view of practicing while engaging in obstructions, and the simile of the water snake. The Buddha also teaches about the raft simile, the six views, and the abandoning of what is not yours.",
    fetter: "ignorance",
    tags: "mn,mn1-50,mn21-30,sensual desire,views,obstructions,raft,water snake,form,feeling,perception,formations,consciousness,not-self,disenchantment,dispassion,liberation",
    id: "mn22",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn28.en": {
    title: "Mah\u0101hatthipadopama sutta - Simile of the Elephant's Footprint",
    description: "Venerable S\u0101riputta explains how all wholesome teachings are encompassed by the Four Noble Truths. He then explains the four great elements of earth, water, fire and air.",
    fetter: "personal existence,conceit,ignorance",
    tags: "mn,mn1-50,mn21-30,four noble truths, aggregates, clinging, dependent co-arising, suffering, impermanence, not-self, equanimity, mindfulness, concentration, simile, elephant, footprint",
    id: "mn28",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn28.pli": {
    title: "Mah\u0101hatthipadopama sutta - Simile of the Elephant's Footprint",
    description: "Venerable S\u0101riputta explains how all wholesome teachings are encompassed by the Four Noble Truths. He then explains the four great elements of earth, water, fire and air.",
    fetter: "self-identity view,conceit,ignorance",
    tags: "mn,mn1-50,mn21-30,four noble truths, aggregates, clinging, dependent origination, dependent co-arising, suffering, impermanence, not-self, equanimity, mindfulness, concentration, simile, elephant, footprint",
    id: "mn28",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn39.en": {
    title: "Mah\u0101assapura sutta - The Greater Discourse at Assapura",
    description: "The Buddha outlines a progressive training guideline for the bhikkhus to undertake in order to be recognized as ascetics and Brahmins. The Buddha also describes the abandonment of the five hindrances, the four jh\u0101nas, and the three knowledges using similes.",
    fetter: "doubt",
    tags: "taints, hindrances, jh\u0101na, recollection, defilements, liberation, ascetic, brahmin, wakefulness, shame, sense-restraint, moderation, eating, livelihood, mindfulness, suffering, three knowledges",
    id: "mn39",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn39.pli": {
    title: "Mah\u0101assapura sutta - The Greater Discourse at Assapura",
    description: "The Buddha outlines a progressive training guideline for the bhikkhus to undertake in order to be recognized as ascetics and Brahmins. The Buddha also describes the abandonment of the five hindrances, the four jh\u0101nas, and the three knowledges using similes.",
    fetter: "doubt",
    tags: "taints, hindrances, jh\u0101na, recollection, defilements, liberation, ascetic, brahmin, wakefulness, shame, sense-restraint, moderation, eating, livelihood, mindfulness, suffering, three knowledges",
    id: "mn39",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn9.en": {
    title: "Samm\u0101di\u1E6D\u1E6Dhi sutta - Right View",
    description: "Venerable S\u0101riputta gives a detailed explanation of right view, the first factor of the noble eightfold path. At the prompting of the other bhikkhus, he approaches the topic from a wide range of perspectives.",
    fetter: "ignorance",
    tags: "right view,mn,mn1-50,mn1-10,ignorance,wisdom,wholesome,unwholesome,nutriment,four noble truths,aging,death,birth,continued existence,clinging,craving,feeling,contact,six sense bases,name and form,consciousness,formations,taints",
    id: "mn9",
    path: "/mn/mn1-50/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn9.pli": {
    title: "Samm\u0101di\u1E6D\u1E6Dhi sutta - Right View",
    description: "Venerable S\u0101riputta gives a detailed explanation of right view, the first factor of the noble eightfold path. At the prompting of the other bhikkhus, he approaches the topic from a wide range of perspectives.",
    fetter: "ignorance",
    tags: "right view,mn,mn1-50,mn1-10,ignorance,wisdom,wholesome,unwholesome,nutriment,four noble truths,aging,death,birth,continued existence,clinging,craving,feeling,contact,six sense bases,name and form,consciousness,formations,taints",
    id: "mn9",
    path: "/mn/mn1-50/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn107.en": {
    title: "Ga\u1E47akamoggall\u0101na sutta - with Accountant Moggall\u0101na",
    description: "The Buddha shares the gradual training guidelines in the Dhamma and discipline with the Brahmin Moggall\u0101na. It is through a gradual practice and gradual progression per these guidelines that one attains the ultimate goal of Nibb\u0101na.",
    fetter: "doubt,adherence to rites and rituals,personal existence",
    tags: "mn,mn101-150,mn101-110,moral conduct,sense restraint,moderation in eating,wakefulness,mindfulness,seclusion,hindrances,jh\u0101na,gradual training guidelines",
    id: "mn107",
    path: "/mn/mn101-152/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn107.pli": {
    title: "Ga\u1E47akamoggall\u0101na sutta - with Accountant Moggall\u0101na",
    description: "The Buddha shares the gradual training guidelines in the Dhamma and discipline with the Brahmin Moggall\u0101na. It is through a gradual practice and gradual progression per these guidelines that one attains the ultimate goal of Nibb\u0101na.",
    fetter: "doubt,adherence to rites and rituals,personal existence view",
    tags: "mn,mn101-150,mn101-110,moral conduct,sense restraint,moderation in eating,wakefulness,mindfulness,seclusion,hindrances,jh\u0101na,gradual training guidelines",
    id: "mn107",
    path: "/mn/mn101-152/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "mn131.en": {
    title: "Bhaddekaratta sutta - A Single Auspicious Night",
    description: "The Buddha shares a powerful verse on what leads one to have had a single auspicious night.",
    fetter: "ignorance",
    tags: "past, future, present, death, effort, diligence, continuous effort, day, night, unshaken, untroubled, mn, mn101-152, mn131",
    id: "mn131",
    path: "/mn/mn101-152/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn131.pli": {
    title: "Bhaddekaratta sutta - A Single Auspicious Night",
    description: "The Buddha shares a powerful verse on what leads one to have had a single auspicious night.",
    fetter: "ignorance",
    tags: "past, future, present, death, effort, diligence, continuous effort, day, night, unshaken, untroubled, mn, mn101-152, mn131",
    id: "mn131",
    path: "/mn/mn101-152/",
    updatedTime: "2024-08-11T09:01:50.000Z"
  },
  "mn140.en": {
    title: "Dh\u0101tuvibha\u1E45ga sutta - Analysis of the Elements",
    description: "The Buddha teaches Venerable Pukkus\u0101ti the Dhamma of this person which constitutes of the six elements, six bases of contact, the eighteen explorations of mind, and is established in four ways.",
    fetter: "ignorance",
    tags: "mn,mn101-150,mn131-140,elements,fire,water,earth,air,space,consciousness,feeling,contact,exploration,peace,truth,relinquishment,peace,ignorance",
    id: "mn140",
    path: "/mn/mn101-152/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn140.pli": {
    title: "Dh\u0101tuvibha\u1E45ga sutta - Analysis of the Elements",
    description: "The Buddha teaches Venerable Pukkus\u0101ti the Dhamma of this person which constitutes of the six elements, six bases of contact, the eighteen explorations of mind, and is established in four ways.",
    fetter: "ignorance",
    tags: "mn,mn101-150,mn131-140,elements,fire,water,earth,air,space,consciousness,feeling,contact,exploration,peace,truth,relinquishment,peace,ignorance",
    id: "mn140",
    path: "/mn/mn101-152/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn55.en": {
    title: "J\u012Bvaka sutta - Discourse with J\u012Bvaka",
    description: "The Buddha explains to J\u012Bvaka the circumstances in which meat may be consumed and the demerit of slaughtering living beings for the Tath\u0101gata or his disciples.",
    fetter: "ill-will,ignorance",
    tags: "mn,mn55,food,meat,compassion,metta,loving-kindness,blameless",
    id: "mn55",
    path: "/mn/mn51-100/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn55.pli": {
    title: "J\u012Bvaka sutta - Discourse with J\u012Bvaka",
    description: "The Buddha explains to J\u012Bvaka the circumstances in which meat may be consumed and the demerit of slaughtering living beings for the Tath\u0101gata or his disciples.",
    fetter: "ill-will,ignorance",
    tags: "mn,mn55,food,meat,compassion,metta,loving-kindness,blameless",
    id: "mn55",
    path: "/mn/mn51-100/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn61.en": {
    title: "Ambala\u1E6D\u1E6Dhikar\u0101hulov\u0101da sutta - Advice to R\u0101hula at Ambala\u1E6D\u1E6Dhika",
    description: "The Buddha teaches R\u0101hula about the importance of truthfulness and how to purify one's bodily, verbal and mental conduct by reflecting on the consequences of one's actions.",
    fetter: "ignorance",
    tags: "truthfulness, reflection, bodily action, verbal action, mental action, mn, mn51-100, mn61-70, lying, right action",
    id: "mn61",
    path: "/mn/mn51-100/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn61.pli": {
    title: "Ambala\u1E6D\u1E6Dhikar\u0101hulov\u0101da sutta - Advice to R\u0101hula at Ambala\u1E6D\u1E6Dhika",
    description: "The Buddha teaches R\u0101hula about the importance of truthfulness and how to purify one's bodily, verbal and mental conduct by reflecting on the consequences of one's actions.",
    fetter: "ignorance",
    tags: "truthfulness, reflection, bodily action, verbal action, mental action, mn, mn51-100, mn61-70, lying, right action",
    id: "mn61",
    path: "/mn/mn51-100/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn64.en": {
    title: "Mah\u0101m\u0101lukya sutta - The Great Discourse to M\u0101lukya",
    description: "The Buddha explains the five lower fetters and the way of practice for abandoning them.",
    fetter: "personal existence,doubt,adherence to rites and rituals,sensual desire,ill-will",
    tags: "mn,mn51-100,mn61-70,personal existence,doubt,adherence to rites and rituals,sensual desire,ill-will,jh\u0101na,formless attainments",
    id: "mn64",
    path: "/mn/mn51-100/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn64.pli": {
    title: "Mah\u0101m\u0101lukya sutta - The Great Discourse to M\u0101lukya",
    description: "The Buddha explains the five lower fetters and the way of practice for abandoning them.",
    fetter: "self-identity view,doubt,adherence to rites and rituals,sensual desire,ill-will",
    tags: "mn,mn51-100,mn61-70,self-identity view,doubt,adherence to rites and rituals,sensual desire,ill-will,jh\u0101na,formless attainments",
    id: "mn64",
    path: "/mn/mn51-100/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "mn70.en": {
    title: "K\u012B\u1E6D\u0101giri sutta - At K\u012B\u1E6D\u0101giri",
    description: "The Buddha starts out by advising the bhikkhus to eat only during the day, without having a meal at night, explaining the interplay of how pleasant, painful and neither-pleasant-nor-painful feelings can lead to furthering of unwholesome or wholesome states. He then shares on the seven kinds of persons and which kinds must act with diligence. The Buddha concludes by describing how final knowledge is attained gradually.",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    tags: "heedfulness,heedlessness,diligence,liberation,wisdom,nibb\u0101na,formless attainment,body-witness,confidence,dhamma,faith,mn,mn51-100,mn61-70,wholesome,unwholesome",
    id: "mn70",
    path: "/mn/mn51-100/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "mn70.pli": {
    title: "K\u012B\u1E6D\u0101giri sutta - At K\u012B\u1E6D\u0101giri",
    description: "The Buddha starts out by advising the bhikkhus to eat only during the day, without having a meal at night, explaining the interplay of how pleasant, painful and neither-pleasant-nor-painful feelings can lead to furthering of unwholesome or wholesome states. He then shares on the seven kinds of persons and which kinds must act with diligence. The Buddha concludes by describing how final knowledge is attained gradually.",
    fetter: "ignorance,adherence to rites and rituals,doubt",
    tags: "heedfulness,heedlessness,diligence,liberation,wisdom,nibb\u0101na,formless attainment,body-witness,confidence,dhamma,faith,mn,mn51-100,mn61-70,wholesome,unwholesome",
    id: "mn70",
    path: "/mn/mn51-100/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "mn72.en": {
    title: "Aggivaccha sutta - Discourse on Fire with Vacchagotta",
    description: "The Buddha has gone beyond all speculative views. He states the spiritual goal with the simile of a fire and explains how the Tath\u0101gata is freed from classification by the aggregates.",
    tags: "mn,mn51-100,mn71-80,conceit,fire,speculative views,five aggregates,liberation",
    fetter: "personal existence, conceit",
    id: "mn72",
    path: "/mn/mn51-100/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "mn72.pli": {
    title: "Aggivaccha sutta - Discourse on Fire with Vacchagotta",
    description: "The Buddha has gone beyond all speculative views. He states the spiritual goal with the simile of a fire and explains how the Tath\u0101gata is freed from classification by the aggregates.",
    tags: "mn,mn51-100,mn71-80,conceit,fire,speculative views,five aggregates,liberation",
    fetter: "self-identity view, conceit",
    id: "mn72",
    path: "/mn/mn51-100/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "mn73.en": {
    title: "Mah\u0101vaccha sutta - Greater Discourse With Vaccha",
    description: "The Buddha describes the wholesome and unwholesome states to the wanderer Vacchagotta, and then answers Vacchagotta's questions about the accomplishments of his disciples.",
    fetter: "doubt",
    tags: "wholesome, unwholesome, greed, aversion, delusion, killing, stealing, sexual misconduct, false speech, malicious speech, harsh speech, idle chatter, craving, ill-will, wrong view, contentment, good-will, right view, arahant, mn, mn51-100, mn71-80",
    id: "mn73",
    path: "/mn/mn51-100/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "mn73.pli": {
    title: "Mah\u0101vaccha sutta - Greater Discourse With Vaccha",
    description: "The Buddha describes the wholesome and unwholesome states to the wanderer Vacchagotta, and then answers Vacchagotta's questions about the accomplishments of his disciples.",
    fetter: "doubt",
    tags: "wholesome, unwholesome, greed, aversion, delusion, killing, stealing, sexual misconduct, false speech, malicious speech, harsh speech, idle chatter, craving, ill-will, wrong view, contentment, good-will, right view, arahant, mn, mn51-100, mn71-80",
    id: "mn73",
    path: "/mn/mn51-100/",
    updatedTime: "2024-08-06T08:16:34.000Z"
  },
  "sn1.1.en": {
    title: "Oghatara\u1E47a sutta - Crossing the Flood",
    description: "The Buddha crossed the flood of suffering without any support and without struggling.",
    tags: "sn,sn1-11,sn1,ignorance,wisdom,Nibb\u0101na",
    fetter: "ignorance",
    id: "sn1.1",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "sn1.1.pli": {
    title: "Oghatara\u1E47a sutta - Crossing the Flood",
    description: "The Buddha crossed the flood of suffering without any support and without struggling.",
    tags: "sn,sn1-11,sn1,ignorance,wisdom,Nibb\u0101na",
    fetter: "ignorance",
    id: "sn1.1",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.10.en": {
    title: "Ara\xF1\xF1a sutta - Wilderness",
    description: "A deity asks the Buddha how the complexion of those dwelling in the wilderness and living the spiritual life becomes serene.",
    fetter: "ignorance",
    tags: "wilderness, complexion, serenity, present, future, past, ignorance, sn, sn1-11, sn1",
    id: "sn1.10",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn1.10.pli": {
    title: "Ara\xF1\xF1a sutta - Wilderness",
    description: "A deity asks the Buddha how the complexion of those dwelling in the wilderness and living the spiritual life becomes serene.",
    fetter: "ignorance",
    tags: "wilderness, complexion, serenity, present, future, past, ignorance, sn, sn1-11, sn1",
    id: "sn1.10",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn1.2.en": {
    title: "Nimokkha sutta - Release",
    description: "The Buddha describes how he knows of the release, liberation and independence for living beings.",
    fetter: "ignorance",
    tags: "nibb\u0101na,wisdom,liberation,sn,sn1-11,sn1",
    id: "sn1.2",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.2.pli": {
    title: "Nimokkha sutta - Release",
    description: "The Buddha describes how he knows of the release, liberation and independence for living beings.",
    fetter: "ignorance",
    tags: "nibb\u0101na,wisdom,liberation,sn,sn1-11,sn1",
    id: "sn1.2",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.3.en": {
    title: "Upan\u012Bya sutta - The Short Life",
    description: "For one brought to old age, there are no shelters.",
    fetter: "ignorance",
    tags: "life,peace,happiness,sn,sn1-11,sn1",
    id: "sn1.3",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.3.pli": {
    title: "Upan\u012Bya sutta - The Short Life",
    description: "For one brought to old age, there are no shelters",
    fetter: "ignorance",
    tags: "life,peace,happiness,sn,sn1-11,sn1",
    id: "sn1.3",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.4.en": {
    title: "Accenti sutta - Flies By",
    description: "Time flies by, one should abandon world's bait, looking for peace.",
    fetter: "ignorance",
    tags: "life,peace,happiness,sn,sn1-11,sn1",
    id: "sn1.4",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.4.pli": {
    title: "Accenti sutta - Flies By",
    description: "Time flies by, one should abandon world's bait, looking for peace.",
    fetter: "ignorance",
    tags: "life,peace,happiness,sn,sn1-11,sn1",
    id: "sn1.4",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.5.en": {
    title: "Katichinda sutta - How Many Should One Cut Off",
    description: "A deity asks the Buddha on how many things should one cut off, abandon, and develop to cross over the flood.",
    fetter: "ignorance",
    tags: "ignorance,fetters,faculties,clinging,sn,sn1-11,sn1",
    id: "sn1.5",
    commentary: "When the deity asks how many should one cut off and the Buddha replies with five, this is referring to the five lower fetters of view of personal existence, doubt, adherence to rites and rituals, sensual desire, and ill-will. One needs to cut these off.\n\nWhen the deity asks how many should one abandon and the Buddha replies with five, this is referring to the five higher fetters of desire for fine-material existence, desire for immaterial existence, conceit, restlessness, and ignorance. One needs to abandon these.\n\nWhen the deity asks how many should one develop and the Buddha replies with five, this is referring to the five spiritual faculties of confidence (faith), energy, mindfulness, collectedness (concentration), and wisdom. One needs to develop these.\n\nWhen the deity asks how many clinging should one overcome and the Buddha replies with five, this is referring to the five clinging aggregates of form, feeling, perception, volitional formations, and consciousness. One needs to overcome these. When one has overcome these five clinging, one is said to have crossed over the flood of suffering.\n",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.5.pli": {
    title: "Katichinda sutta - How Many Should One Cut Off",
    description: "A deity asks the Buddha on how many things should one cut off, abandon, and develop to cross over the flood.",
    fetter: "ignorance",
    tags: "ignorance,fetters,faculties,clinging,sn,sn1-11,sn1",
    id: "sn1.5",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.51.en": {
    title: "Jar\u0101 sutta - Old Age",
    description: "A deity asks the Blessed One what is good until old age, what is good when established, what is a treasure for humans, and what cannot be stolen by thieves.",
    fetter: "ignorance",
    tags: "old age, virtue, faith, wisdom, merit, sn, sn1-11, sn1",
    id: "sn1.51",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.51.pli": {
    title: "Jar\u0101 sutta - Old Age",
    description: "A deity asks the Blessed One what is good until old age, what is good when established, what is a treasure for humans, and what cannot be stolen by thieves.",
    fetter: "ignorance",
    tags: "old age, virtue, faith, wisdom, merit, sn, sn1-11, sn1",
    id: "sn1.51",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.6.en": {
    title: "J\u0101gara sutta - Awake",
    description: "A deity asks the Buddha how many are asleep among those awake, how many are awake among those asleep, how many stir up the dust, and how many purify it.",
    fetter: "ignorance",
    tags: "ignorance,spiritual faculties,awakening,sn,sn1-11,sn1",
    id: "sn1.6",
    commentary: 'When the deity asks how many are asleep among those awake and the Buddha replies with five, this refers to the five lower fetters of personal existence, doubt, adherence to rites and rituals, sensual desire, and ill-will. These fetters keep one "asleep" even in the presence of wisdom.\n\nWhen the deity asks how many are awake among those asleep and the Buddha replies with five, this refers to the five spiritual faculties of confidence (faith), energy, mindfulness, collectedness, and wisdom. These faculties keep one "awake" and mindful even in the midst of ignorance.\n\nWhen the deity asks by how many is the dust stirred up and the Buddha replies with five, this refers to the five hindrances of sensual desire, ill-will, sloth and torpor, restlessness and worry, and doubt. These hindrances cloud the mind with impurities.\n\nWhen the deity asks by how many is it purified and the Buddha replies with five, this refers to the same five spiritual faculties \u2014 confidence, energy, mindfulness, collectedness, and wisdom. These faculties purify the mind, leading to clarity and liberation.\n',
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.6.pli": {
    title: "J\u0101gara sutta - Awake",
    description: "A deity asks the Buddha how many are asleep among those awake, how many are awake among those asleep, how many stir up the dust, and how many purify it.",
    fetter: "ignorance",
    tags: "ignorance,spiritual faculties,awakening,sn,sn1-11,sn1",
    id: "sn1.6",
    commentary: 'When the deity asks how many are asleep among those awake and the Buddha replies with five, this refers to the five lower fetters of self-identity view, doubt, adherence to rites and rituals, sensual desire, and ill-will. These fetters keep one "asleep" even in the presence of wisdom.\n\nWhen the deity asks how many are awake among those asleep and the Buddha replies with five, this refers to the five spiritual faculties of confidence (faith), energy, mindfulness, collectedness, and wisdom. These faculties keep one "awake" and mindful even in the midst of ignorance.\n\nWhen the deity asks by how many is the dust stirred up and the Buddha replies with five, this refers to the five hindrances of sensual desire, ill-will, sloth and torpor, restlessness and worry, and doubt. These hindrances cloud the mind with impurities.\n\nWhen the deity asks by how many is it purified and the Buddha replies with five, this refers to the same five spiritual faculties \u2014 confidence, energy, mindfulness, collectedness, and wisdom. These faculties purify the mind, leading to clarity and liberation.\n',
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn1.7.en": {
    title: "Appa\u1E6Dividita sutta - Not Fully Comprehended",
    description: "Those who do not fully comprehend the teachings are led by others' views and do not awaken from sleep. Those who fully comprehend the teachings are not led by others' views and are awakened, fully comprehending, faring evenly amidst the uneven path.",
    fetter: "personal existence,adherence to rites and rituals,doubt",
    tags: "comprehension, awakening, speculative views, teachings, evenness, unevenness, sn, sn1-11, sn1",
    id: "sn1.7",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn1.7.pli": {
    title: "Appa\u1E6Dividita sutta - Not Fully Comprehended",
    description: "Those who do not fully comprehend the teachings are led by others' views and do not awaken from sleep. Those who fully comprehend the teachings are not led by others' views and are awakened, fully comprehending, faring evenly amidst the uneven path.",
    fetter: "personal existence,adherence to rites and rituals,doubt",
    tags: "comprehension, awakening, speculative views, teachings, evenness, unevenness, sn, sn1-11, sn1",
    id: "sn1.7",
    path: "/sn/sn1-11/sn1/",
    updatedTime: "2024-09-01T15:06:44.000Z"
  },
  "sn3.13.en": {
    title: "Do\u1E47ap\u0101ka sutta - A Bucket Of Rice",
    description: "The Buddha observes the King Pasenadi as huffing and puffing and advises him on moderation in eating.",
    fetter: "adherence to rites and rituals",
    tags: "gradual training guideline,mindfulness,eating,moderation,sn,sn1-11,sn3",
    id: "sn3.13",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn3.13.pli": {
    title: "Do\u1E47ap\u0101ka sutta - A Bucket Of Rice",
    description: "The Buddha observes the King Pasenadi as huffing and puffing and advises him on moderation in eating.",
    fetter: "adherence to rites and rituals",
    tags: "gradual training guideline,mindfulness,eating,moderation,sn,sn1-11,sn3",
    id: "sn3.13",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn3.17.en": {
    title: "Appam\u0101da sutta - Diligence",
    description: "King Pasenadi asks the Buddha if there is one Dhamma which, having accomplished, secures both kinds of welfare \u2014 welfare pertaining to the present life and that pertaining to the next life. The Buddha explains that diligence is that one Dhamma.",
    fetter: "ignorance",
    tags: "diligence, welfare, present, future, ignorance, sn, sn1-11, sn3",
    id: "sn3.17",
    commentary: "Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining both an alertness and care (gentleness).\n",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-09-20T18:06:01.000Z"
  },
  "sn3.17.pli": {
    title: "Appam\u0101da sutta - Diligence",
    description: "King Pasenadi asks the Buddha if there is one Dhamma which, having accomplished, secures both kinds of welfare \u2014 welfare pertaining to the present life and that pertaining to the next life. The Buddha explains that diligence is that one Dhamma.",
    fetter: "ignorance",
    tags: "diligence, welfare, present, future, ignorance, sn, sn1-11, sn3",
    id: "sn3.17",
    commentary: "Diligence is a quality of the mind that is about carrying out one's duty or obligations well, with continuous effort, while maintaining both an alertness and care (gentleness).\n",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-09-20T18:06:20.000Z"
  },
  "sn3.4.en": {
    title: "Piya sutta - Dear",
    description: "One who engages in good conduct by body, speech, and mind is dear to themselves.",
    fetter: "ignorance",
    tags: "merit,good conduct,bad conduct,dear,sn,sn1-11,sn3",
    id: "sn3.4",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn3.4.pli": {
    title: "Piya sutta - Dear",
    description: "One who engages in good conduct by body, speech, and mind is dear to themselves.",
    fetter: "ignorance",
    tags: "merit,good conduct,bad conduct,dear,sn,sn1-11,sn3",
    id: "sn3.4",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn3.6.en": {
    title: "Appaka sutta - Few",
    description: "There are few in the world, who having obtained great wealth, neither become arrogant nor negligent, do not become obsessed with sensual pleasures, and do not act wrongly towards others.",
    fetter: "ignorance, sensual desire",
    tags: "arrogance, wealth, sensual pleasure, sensual desire, deer, trap, negligance, sn, sn1-11, sn3",
    id: "sn3.6",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn3.6.pli": {
    title: "Appaka sutta - Few",
    description: "There are few in the world, who having obtained great wealth, neither become arrogant nor negligent, do not become obsessed with sensual pleasures, and do not act wrongly towards others.",
    fetter: "ignorance, sensual desire",
    tags: "arrogance, wealth, sensual pleasure, sensual desire, deer, trap, negligance, sn, sn1-11, sn3",
    id: "sn3.6",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn3.8.en": {
    title: "Mallik\u0101 sutta - With Queen Mallik\u0101",
    description: "King Pasenadi of Kosala and Queen Mallik\u0101 discuss who is dearer to them.",
    fetter: "ignorance",
    tags: "dear,sn,sn1-11,sn3",
    id: "sn3.8",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-09-14T16:19:58.000Z"
  },
  "sn3.8.pli": {
    title: "Mallik\u0101 sutta - With Queen Mallik\u0101",
    description: "King Pasenadi of Kosala and Queen Mallik\u0101 discuss who is dearer to them.",
    fetter: "ignorance",
    tags: "dear,sn,sn1-11,sn3",
    id: "sn3.8",
    path: "/sn/sn1-11/sn3/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn7.2.en": {
    title: "Akkosa sutta - Insult",
    description: "A brahmin approaches the Buddha and abuses and insults him. The Buddha doesn't accept it, and explains this to the brahmin through a simile.",
    fetter: "ill-will",
    tags: "anger,quarrel,ill-will,mindful,insult,harmony,discipline,heal,sn,sn1-11,sn7",
    id: "sn7.2",
    path: "/sn/sn1-11/sn7/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn7.2.pli": {
    title: "Akkosa sutta - Insult",
    description: "A brahmin approaches the Buddha and abuses and insults him. The Buddha doesn't accept it, and explains this to the brahmin through a simile.",
    fetter: "ill-will",
    tags: "anger,quarrel,ill-will,mindful,insult,harmony,discipline,heal,sn,sn1-11,sn7",
    id: "sn7.2",
    path: "/sn/sn1-11/sn7/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn12.1.en": {
    title: "Pa\u1E6Diccasamupp\u0101da sutta - Dependent Origination",
    description: "The Buddha explains what is dependent co-arising, the arising and cessation of suffering.",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,dependent origination,dependent co-arising,ignorance,wisdom,suffering",
    id: "sn12.1",
    path: "/sn/sn12-21/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "sn12.1.pli": {
    title: "Pa\u1E6Diccasamupp\u0101da sutta - Dependent Origination",
    description: "The Buddha explains what is dependent co-arising, the arising and cessation of suffering.",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,dependent origination, dependent co-arising,ignorance,wisdom,suffering",
    id: "sn12.1",
    path: "/sn/sn12-21/",
    updatedTime: "2024-08-02T13:12:23.000Z"
  },
  "sn12.15.en": {
    title: "Kacc\u0101nagotta sutta - With Kacc\u0101nagotta",
    description: "Venerable Kacc\u0101nagotta asks the Buddha about right view, and the Buddha explains how",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,right view,ignorance,wisdom",
    id: "sn12.15",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.15.pli": {
    title: "Kacc\u0101nagotta sutta - With Kacc\u0101nagotta",
    description: "Venerable Kacc\u0101nagotta asks the Buddha about right view, and the Buddha explains how",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,right view,ignorance,wisdom",
    id: "sn12.15",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.23.en": {
    title: "Upanisa sutta - Proximate Causes",
    description: "The Buddha explains the proximate causes for the ending of defilements. The twelve factors leading to the ending of defilements are explained along with twelve factors that lead to suffering.",
    fetter: "ignorance",
    tags: "sn,sn12-21,defilements,dependent origination,suffering,liberation",
    id: "sn12.23",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.23.pli": {
    title: "Upanisa sutta - Proximate Causes",
    description: "The Buddha explains the proximate causes for the ending of defilements. The twelve factors leading to the ending of defilements are explained along with twelve factors that lead to suffering.",
    fetter: "ignorance",
    tags: "sn,sn12-21,defilements,dependent origination, dependent co-arising,suffering,liberation",
    id: "sn12.23",
    path: "/sn/sn12-21/",
    updatedTime: "2024-08-02T13:12:23.000Z"
  },
  "sn12.33.en": {
    title: "\xD1\u0101\u1E47avatthu sutta - Basis of Knowledge",
    description: "The Buddha describes the forty-four bases of knowledge by understanding.",
    fetter: "ignorance",
    tags: "sn,sn12-21,ignorance,volitional formations,aging and death,birth,right view,four noble truths",
    id: "sn12.33",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn12.33.pli": {
    title: "\xD1\u0101\u1E47avatthu sutta - Basis of Knowledge",
    description: "The Buddha",
    fetter: "ignorance",
    tags: "sn,sn12-21,ignorance,volitional formations,aging and death,birth,right view,four noble truths",
    id: "sn12.33",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn12.38.en": {
    title: "Cetan\u0101 sutta - Intending",
    description: "Intending, planning, and underlying tendencies are the basis for the continuation of consciousness.",
    fetter: "ignorance",
    tags: "consciousness,dependent origination,ignorance,craving,clinging,attachment,sn,sn12",
    id: "sn12.38",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn12.38.pli": {
    title: "Cetan\u0101 sutta - Intending",
    description: "Intending, planning, and underlying tendencies are the basis for the continuation of consciousness.",
    fetter: "ignorance",
    tags: "consciousness,dependent origination, dependent co-arising,ignorance,craving,clinging,attachment,sn,sn12",
    id: "sn12.38",
    path: "/sn/sn12-21/",
    updatedTime: "2024-08-02T13:12:23.000Z"
  },
  "sn12.44.en": {
    title: "Loka sutta - World",
    description: "The Buddha explains the arising and dissolution of the world through the six sense bases.",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,world,ignorance,wisdom,six sense bases",
    id: "sn12.44",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.44.pli": {
    title: "Loka sutta - World",
    description: "The Buddha explains the arising and dissolution of the world through the six sense bases.",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,world,ignorance,wisdom,six sense bases",
    id: "sn12.44",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.52.en": {
    title: "Up\u0101d\u0101na sutta - Clinging",
    description: "The Buddha uses the simile of a bonfire to explain how perceiving gratification in objects that can be grasped at leads to clinging, to suffering, and how perceiving drawbacks in objects that can be grasped at leads to the cessation of clinging, to the cessation of suffering.",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,craving,clinging,ignorance,bonfire,wisdom,dependent origination",
    id: "sn12.52",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.52.pli": {
    title: "Up\u0101d\u0101na sutta - Clinging",
    description: "The Buddha uses the simile of a bonfire to explain how perceiving gratification in objects that can be grasped at leads to clinging, to suffering, and how perceiving drawbacks in objects that can be grasped at leads to the cessation of clinging, to the cessation of suffering.",
    fetter: "ignorance",
    tags: "sn,sn12-21,sn12,craving,clinging,ignorance,bonfire,wisdom",
    id: "sn12.52",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn12.59.en": {
    title: "Vi\xF1\xF1\u0101\u1E47a sutta - Consciousness",
    description: "When one delights in and craves things that are the basis for fetters, there is a descent of consciousness.",
    fetter: "ignorance",
    tags: "dependent co-arising,ignorance,consciousness,craving,desire,attachment,sn,sn12-21",
    id: "sn12.59",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn12.59.pli": {
    title: "Vi\xF1\xF1\u0101\u1E47a sutta - Consciousness",
    description: "When one delights in and craves things that are the basis for fetters, there is a descent of consciousness.",
    fetter: "ignorance",
    tags: "dependent co-arising,ignorance,consciousness,craving,desire,attachment,sn,sn12-21",
    id: "sn12.59",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-24T01:22:55.000Z"
  },
  "sn13.1.en": {
    title: "Nakhasikh\u0101 sutta - Tip Of The Fingernail",
    description: "For a person attained to right view, the suffering that remains is only a small amount compared to the suffering that has been exhausted and consumed.",
    fetter: "ignorance, doubt",
    tags: "right view, suffering, sn, ignorance, doubt, fingernail, sn12-21",
    id: "sn13.1",
    path: "/sn/sn12-21/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "sn13.1.pli": {
    title: "Nakhasikh\u0101 sutta - Tip Of The Fingernail",
    description: "For a person attained to right view, the suffering that remains is only a small amount compared to the suffering that has been exhausted and consumed.",
    fetter: "ignorance, doubt",
    tags: "right view, suffering, sn, ignorance, doubt, fingernail, sn12-21",
    id: "sn13.1",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.1.en": {
    title: "Dh\u0101tun\u0101natta sutta - Diversity Of Elements",
    description: "The Buddha describes the diversity of elements.",
    fetter: "ignorance",
    tags: "elements, diversity, sn, ignorance, sn12-21, six sense bases",
    id: "sn14.1",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.1.pli": {
    title: "Dh\u0101tun\u0101natta sutta - Diversity Of Elements",
    description: "The Buddha describes the diversity of elements.",
    fetter: "ignorance",
    tags: "elements, diversity, sn, ignorance, sn12-21, six sense bases",
    id: "sn14.1",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.12.en": {
    title: "Sanid\u0101na sutta - From A Cause",
    description: "The Buddha explains how thoughts of sensuality, ill-will, and harming arise from a cause and how to abandon them.",
    fetter: "sensual desire, ill-will",
    tags: "cause, sensuality, ill-will, harming, sn, sn12-21, relinquishment, good-will, non-harming",
    id: "sn14.12",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.12.pli": {
    title: "Sanid\u0101na sutta - From A Cause",
    description: "The Buddha explains how thoughts of sensuality, ill-will, and harming arise from a cause and how to abandon them.",
    fetter: "sensual desire, ill-will",
    tags: "cause, sensuality, ill-will, harming, sn, sn12-21, relinquishment, good-will, non-harming",
    id: "sn14.12",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.15.en": {
    title: "Walking Back and Forth",
    description: "In this teaching, the Buddha is addressing on how beings come together and associate based on dispositions and intent.",
    tags: "beings,friendship,sn12-21,sn14",
    fetter: "ignorance",
    id: "sn14.15",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-13T10:38:00.000Z"
  },
  "sn14.15.pli": {
    title: "Walking Back and Forth",
    description: "In this teaching, the Buddha is addressing on how beings come together and associate based on dispositions and intent.",
    tags: "beings,friendship,sn12-21,sn14",
    fetter: "ignorance",
    id: "sn14.15",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn14.18.en": {
    title: "Assaddham\u016Blaka sutta - Root Of Faithlessness",
    description: "Being associate and come together based on their qualities.",
    fetter: "doubt, ignorance",
    tags: "faith, confidence, faithlessness, shamelessness, wisdom, ignorance, doubt, sn, sn12-21",
    id: "sn14.18",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.18.pli": {
    title: "Assaddham\u016Blaka sutta - Root Of Faithlessness",
    description: "Being associate and come together based on their qualities.",
    fetter: "doubt, ignorance",
    tags: "faith, confidence, faithlessness, shamelessness, wisdom, ignorance, doubt, sn, sn12-21",
    id: "sn14.18",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-30T07:54:26.000Z"
  },
  "sn14.37.en": {
    title: "Sama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins",
    description: "The Buddha explains how understanding the attraction, danger, and escape in the four elements leads to peace in this very life.",
    tags: "sn,sn12-21,sn14,elements,air,water,fire,earth,peace,nibba\u0304na",
    fetter: "ignorance",
    id: "sn14.37",
    path: "/sn/sn12-21/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn14.37.pli": {
    title: "Sama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins",
    description: "The Buddha explains how understanding the attraction, danger, and escape in the four elements leads to peace in this very life.",
    tags: "sn,sn12-21,sn14,elements,air,water,fire,earth,peace,nibba\u0304na",
    fetter: "ignorance",
    id: "sn14.37",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn14.38.en": {
    title: "Dutiyasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (Second)",
    description: "The Buddha explains how understanding the arising and dissolution of the four elements, and the attraction, danger, and the escape in the four elements leads to peace in this very life.",
    tags: "sn,sn12-21,sn14,elements,air,water,fire,earth,peace",
    fetter: "ignorance",
    id: "sn14.38",
    path: "/sn/sn12-21/",
    updatedTime: "2024-09-13T17:46:26.000Z"
  },
  "sn14.38.pli": {
    title: "Dutiyasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (Second)",
    description: "The Buddha explains how understanding the arising and dissolution of the four elements, and the attraction, danger, and the escape in the four elements leads to peace in this very life.",
    tags: "sn,sn12-21,sn14,elements,air,water,fire,earth,peace",
    fetter: "ignorance",
    id: "sn14.38",
    path: "/sn/sn12-21/",
    updatedTime: "2024-09-13T17:46:26.000Z"
  },
  "sn14.39.en": {
    title: "Tatiyasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (Third)",
    description: "The Buddha explains how understanding the arising, the cessation, and the path leading to the cessation in regards to the four elements leads to peace in this very life.",
    tags: "sn,sn12-21,sn14,elements,air,water,fire,earth,peace,cessation",
    fetter: "ignorance",
    id: "sn14.39",
    path: "/sn/sn12-21/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn14.39.pli": {
    title: "Tatiyasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (Third)",
    description: "The Buddha explains how understanding the arising, the cessation, and the path leading to the cessation in regards to the four elements leads to peace in this very life.",
    tags: "sn,sn12-21,sn14,elements,air,water,fire,earth,peace,cessation",
    fetter: "ignorance",
    id: "sn14.39",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn17.2.en": {
    title: "Balisa sutta - Fishing Hook",
    description: "The Buddha explains how possessions, respect, and popularity are painful, severe, and obstructive to the attainment of the unsurpassed safety from the yoke using a simile of a fisherman throwing a baited hook into a deep pool of water.",
    tags: "sn,sn12-21,sn17,possessions,respect,popularity,obstruction",
    fetter: "sensual desire,conceit,personal existence,ignorance",
    id: "sn17.2",
    path: "/sn/sn12-21/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn17.2.pli": {
    title: "Balisa sutta - Fishing Hook",
    description: "The Buddha explains how possessions, respect, and popularity are painful, severe, and obstructive to the attainment of the unsurpassed safety from the yoke using a simile of a fisherman throwing a baited hook into a deep pool of water.",
    tags: "sn,sn12-21,sn17,possessions,respect,popularity,obstruction",
    fetter: "sensual desire,conceit,self-identity view,ignorance",
    id: "sn17.2",
    path: "/sn/sn12-21/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn22.15.en": {
    title: "Yadanicca sutta - That Which is Impermanent",
    description: "The Buddha shares a reflection on the three characteristics of impermanence, suffering (discontentment) and not-self for the five aggregates of form, feeling, perception, formations, and consciousness.",
    fetter: "ignorance",
    tags: "impermanent,suffering,not-self,form,feeling,perception,formations,consciousness,sn,sn22-34,sn22",
    id: "sn22.15",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.15.pli": {
    title: "Yadanicca sutta - That Which is Impermanent",
    description: "The Buddha shares a reflection on the three characteristics of impermanence, suffering (discontentment) and not-self for the five aggregates of form, feeling, perception, formations, and consciousness.",
    fetter: "ignorance",
    tags: "impermanent,suffering,not-self,form,feeling,perception,formations,consciousness,sn,sn22-34,sn22",
    id: "sn22.15",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.29.en": {
    title: "Abhinandana sutta - Delight",
    description: "The Buddha explains that whoever delights in the five aggregates, delights in suffering and is not freed from suffering.",
    fetter: "ignorance",
    tags: "form,feeling,perception,formations,consciousness,delight,suffering,sn,sn22-34,sn22",
    id: "sn22.29",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.29.pli": {
    title: "Abhinandana sutta - Delight",
    description: "The Buddha explains that whoever delights in the five aggregates, delights in suffering and is not freed from suffering.",
    fetter: "ignorance",
    tags: "form,feeling,perception,formations,consciousness,delight,suffering,sn,sn22-34,sn22",
    id: "sn22.29",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.45.en": {
    title: "Anicca sutta - Impermanence",
    description: "The Buddha describes on the impermanent, stressful and not-self nature of the five aggregates of form, feeling, perception, formations and consciousness.",
    fetter: "ignorance",
    tags: "form, feeling, perception, formations, consciousness, impermanence, discontentment, stress, not self, sn, sn22-34, sn22",
    id: "sn22.45",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.45.pli": {
    title: "Anicca sutta - Impermanence",
    description: "The Buddha describes on the impermanent, stressful and not-self nature of the five aggregates of form, feeling, perception, formations and consciousness.",
    fetter: "ignorance",
    tags: "form, feeling, perception, formations, consciousness, impermanence, discontentment, stress, not self, sn, sn22-34, sn22",
    id: "sn22.45",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.56.en": {
    title: "Up\u0101d\u0101naparipavatta sutta - Cycle of Clinging",
    description: "The Buddha describes the five aggregates subject to clinging - form, feeling, perception, formations, and consciousness.",
    fetter: "ignorance",
    tags: "form, feeling, perception, formations, consciousness, clinging, sn, sn22-34, sn22",
    id: "sn22.56",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.56.pli": {
    title: "Up\u0101d\u0101naparipavatta sutta - Cycle of Clinging",
    description: "The Buddha describes the five aggregates subject to clinging - form, feeling, perception, formations, and consciousness.",
    fetter: "ignorance",
    tags: "form, feeling, perception, formations, consciousness, clinging, sn, sn22-34, sn22",
    id: "sn22.56",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.58.en": {
    title: "Samm\u0101sambuddha sutta - Perfectly Awakened One",
    description: "The Buddha explains the distinction between a perfectly awakened one and a bhikkhu who is liberated by wisdom.",
    fetter: "ignorance",
    tags: "sn, sn22-34, sn22, tath\u0101gata, arahant, samm\u0101sambuddha, liberated by wisdom",
    id: "sn22.58",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.58.pli": {
    title: "Samm\u0101sambuddha sutta - Perfectly Awakened One",
    description: "The Buddha explains the distinction between a perfectly awakened one and a bhikkhu who is liberated by wisdom.",
    fetter: "ignorance",
    tags: "sn, sn22-34, sn22, tath\u0101gata, arahant, samm\u0101sambuddha, liberated by wisdom",
    id: "sn22.58",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.76.en": {
    title: "Arahanta sutta - Arahants",
    description: "The Buddha explains how one becomes the perfected one, an arahant, and shares verses on their qualities.",
    fetter: "doubt",
    tags: "form, feeling, perception, volitional formations, consciousness, five aggregates, disenchantment, dispassion, liberation, arahant, sn, sn22-34, sn22",
    id: "sn22.76",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn22.76.pli": {
    title: "Arahanta sutta - Arahants",
    description: "The Buddha explains how one becomes the perfected one, an arahant, and shares verses on their qualities.",
    fetter: "doubt",
    tags: "form, feeling, perception, volitional formations, consciousness, five aggregates, disenchantment, dispassion, liberation, arahant, sn, sn22-34, sn22",
    id: "sn22.76",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.78.en": {
    title: "S\u012Bha sutta - The Lion",
    description: "The Buddha explains how his teaching of the Dhamma inspires fear and dread in the deities, just as the lion's roar inspires fear in the animals.",
    fetter: "ignorance",
    tags: "lion, fear, majesty, sn, sn22-34, sn22, ignorance, five aggregates, form, feeling, perception, formations, consciousness",
    id: "sn22.78",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-18T09:28:16.000Z"
  },
  "sn22.78.pli": {
    title: "S\u012Bha sutta - The Lion",
    description: "The Buddha explains how his teaching of the Dhamma inspires fear and dread in the deities, just as the lion's roar inspires fear in the animals.",
    fetter: "ignorance",
    tags: "lion, fear, majesty, sn, sn22-34, sn22, ignorance, five aggregates, form, feeling, perception, formations, consciousness",
    id: "sn22.78",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-18T09:28:16.000Z"
  },
  "sn22.82.en": {
    title: "Pu\u1E47\u1E47ama sutta - The Full Moon Night",
    description: "On a full moon night with the Sangha at S\u0101vatthi, the Buddha answers a series of ten questions on the aggregates. He answers on the root of clinging, the cause and condition for the designation of the aggregates, how identity view arises, the gratification, danger, and escape from the aggregates, and on ending conceit.",
    fetter: "personal existence, conceit, ignorance",
    tags: "five aggregates, clinging, designation, desire, personal existence, gratification, danger, escape, conceit, I am, not-self, sn, sn22-34, sn22",
    id: "sn22.82",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.82.pli": {
    title: "Pu\u1E47\u1E47ama sutta - The Full Moon Night",
    description: "On a full moon night with the Sangha at S\u0101vatthi, the Buddha answers a series of ten questions on the aggregates. He answers on the root of clinging, the cause and condition for the designation of the aggregates, how identity view arises, the gratification, danger, and escape from the aggregates, and on ending conceit.",
    fetter: "personal existence, conceit, ignorance",
    tags: "five aggregates, clinging, designation, desire, self-identity view, gratification, danger, escape, conceit, I am, not-self, sn, sn22-34, sn22",
    id: "sn22.82",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.89.en": {
    title: "Khemaka sutta - With Khemaka",
    description: 'Venerable Khemaka is ill, and some elder bhikkhus ask D\u0101saka to convey their concern to him. A series of exchanges ensue, mediated by D\u0101saka, until Khemaka, despite his illness, goes to see the elder bhikkhus himself. The elders inquire about his understanding of the Dhamma. Khemaka explains that while he does not identify any of the five aggregates (form, feeling, perception, formations, and consciousness) as self, he still experiences a subtle "I am" conceit associated with these aggregates. He likens this to the lingering scent on a cleaned cloth, which eventually fades away.',
    fetter: "conceit",
    tags: "I am, conceit, five aggregates, Khemaka, not-self, sn, sn22-34, sn22",
    id: "sn22.89",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.89.pli": {
    title: "Khemaka sutta - With Khemaka",
    description: 'Venerable Khemaka is ill, and some elder bhikkhus ask D\u0101saka to convey their concern to him. A series of exchanges ensue, mediated by D\u0101saka, until Khemaka, despite his illness, goes to see the elder bhikkhus himself. The elders inquire about his understanding of the Dhamma. Khemaka explains that while he does not identify any of the five aggregates (form, feeling, perception, formations, and consciousness) as self, he still experiences a subtle "I am" conceit associated with these aggregates. He likens this to the lingering scent on a cleaned cloth, which eventually fades away.',
    fetter: "conceit",
    tags: "I am, conceit, five aggregates, Khemaka, not-self, sn, sn22-34, sn22",
    id: "sn22.89",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.95.en": {
    title: "Phe\u1E47api\u1E47\u1E0D\u016Bpama sutta - The Simile Of The Lump Of Foam",
    description: "The Buddha presents a series of similes for the five aggregates - physical form is akin to a lump of foam, feelings akin to water bubbles, perception like a mirage, volitional formations are like a tree without a core, and consciousness is similar to a magic trick.",
    fetter: "ignorance",
    tags: "form, feelings, perceptions, volitional formations, consciousness, emptiness, essence, simile, aggregates, sn, sn22-34, sn22",
    id: "sn22.95",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn22.95.pli": {
    title: "Phe\u1E47api\u1E47\u1E0D\u016Bpama sutta - The Simile Of The Lump Of Foam",
    description: "The Buddha presents a series of similes for the five aggregates - physical form is akin to a lump of foam, feelings akin to water bubbles, perception like a mirage, volitional formations are like a tree without a core, and consciousness is similar to a magic trick.",
    fetter: "ignorance",
    tags: "form, feelings, perceptions, volitional formations, consciousness, emptiness, essence, simile, aggregates, sn, sn22-34, sn22",
    id: "sn22.95",
    path: "/sn/sn22-34/sn22/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn23.2.en": {
    title: "Satta sutta - Living Beings",
    description: "The Buddha explains to Venerable R\u0101dha that a living being is defined by desire, passion, delight, and craving in form, feeling, perception, formations, and consciousness.",
    fetter: "ignorance",
    tags: "being, form, feeling, perception, formations, consciousness, craving, sn, sn22-34, sn23",
    id: "sn23.2",
    path: "/sn/sn22-34/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn23.2.pli": {
    title: "Satta sutta - Living Beings",
    description: "The Buddha explains to Venerable R\u0101dha that a living being is defined by desire, passion, delight, and craving in form, feeling, perception, formations, and consciousness.",
    fetter: "ignorance",
    tags: "being, form, feeling, perception, formations, consciousness, craving, sn, sn22-34, sn23",
    id: "sn23.2",
    path: "/sn/sn22-34/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn25.1.en": {
    title: "Cakkhu sutta - Eye",
    description: "The Buddha explains to the bhikkhus that the eye, ear, nose, tongue, body, and mind are impermanent, changing, and becoming otherwise. One who has faith and conviction in these phenomena is called a faith-follower, one who has entered the fixed course of rightness, entered the plane of awakened beings, and is incapable of performing an action that would lead to rebirth in lower realms.",
    fetter: "ignorance",
    tags: "impermanence, six sense bases, faith, stream-entry, ignorance, sn, sn22-34, sn25",
    id: "sn25.1",
    path: "/sn/sn22-34/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn25.1.pli": {
    title: "Cakkhu sutta - Eye",
    description: "The Buddha explains to the bhikkhus that the eye, ear, nose, tongue, body, and mind are impermanent, changing, and becoming otherwise. One who has faith and conviction in these phenomena is called a faith-follower, one who has entered the fixed course of rightness, entered the plane of awakened beings, and is incapable of performing an action that would lead to rebirth in lower realms.",
    fetter: "ignorance",
    tags: "impermanence, six sense bases, faith, stream-entry, ignorance, sn, sn22-34, sn25",
    id: "sn25.1",
    path: "/sn/sn22-34/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn28.1.en": {
    title: "Vivekaja sutta - Born From Seclusion",
    description: "The Venerable S\u0101riputta describes his experience of the first jh\u0101na.",
    fetter: "conceit",
    tags: "jhana, conceit, sn, sn22-34, sn28",
    id: "sn28.1",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn28.1.pli": {
    title: "Vivekaja sutta - Born From Seclusion",
    description: "The Venerable S\u0101riputta describes his experience of the first jh\u0101na.",
    fetter: "conceit",
    tags: "jhana, conceit, sn, sn22-34, sn28",
    id: "sn28.1",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn33.1.en": {
    title: "R\u016Bpaa\xF1\xF1\u0101\u1E47a sutta - Not Knowing Form",
    description: "Various kinds of views arise in the world due to not knowing form, the arising of form, the cessation of form, and the practice leading to the cessation of form.",
    fetter: "ignorance,personal existence",
    tags: "form,views,ignorance,personal existence,sn,sn22-34,sn33",
    id: "sn33.1",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.1.pli": {
    title: "R\u016Bpaa\xF1\xF1\u0101\u1E47a sutta - Not Knowing Form",
    description: "Various kinds of views arise in the world due to not knowing form, the arising of form, the cessation of form, and the practice leading to the cessation of form.",
    fetter: "ignorance,self-identity view",
    tags: "form,views,ignorance,self-identity view,sn,sn22-34,sn33",
    id: "sn33.1",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.2.en": {
    title: "Vedan\u0101a\xF1\xF1\u0101\u1E47a sutta - Not Knowing Feeling",
    description: "Various kinds of views arise in the world due to not knowing feeling, the arising of feeling, the cessation of feeling, and the practice leading to the cessation of feeling.",
    fetter: "ignorance,personal existence",
    tags: "feeling,views,ignorance,personal existence,sn,sn22-34,sn33",
    id: "sn33.2",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.2.pli": {
    title: "Vedan\u0101a\xF1\xF1\u0101\u1E47a sutta - Not Knowing Feeling",
    description: "Various kinds of views arise in the world due to not knowing feeling, the arising of feeling, the cessation of feeling, and the practice leading to the cessation of feeling.",
    fetter: "ignorance,self-identity view",
    tags: "feeling,views,ignorance,self-identity view,sn,sn22-34,sn33",
    id: "sn33.2",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.3.en": {
    title: "Sa\xF1\xF1\u0101a\xF1\xF1\u0101\u1E47a sutta - Not Knowing Perception",
    description: "Various kinds of views arise in the world due to not knowing perception, the arising of perception, the cessation of perception, and the practice leading to the cessation of perception.",
    fetter: "ignorance,personal existence",
    tags: "perception,views,ignorance,personal existence,sn,sn22-34,sn33",
    id: "sn33.3",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.3.pli": {
    title: "Sa\xF1\xF1\u0101a\xF1\xF1\u0101\u1E47a sutta - Not Knowing Perception",
    description: "Various kinds of views arise in the world due to not knowing perception, the arising of perception, the cessation of perception, and the practice leading to the cessation of perception.",
    fetter: "ignorance,self-identity view",
    tags: "perception,views,ignorance,self-identity view,sn,sn22-34,sn33",
    id: "sn33.3",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.4.en": {
    title: "Sa\u1E45kh\u0101raa\xF1\xF1\u0101\u1E47a sutta - Not Knowing Volitional Formations",
    description: "Various kinds of views arise in the world due to not knowing volitional formations, the arising of volitional formations, the cessation of volitional formations, and the practice leading to the cessation of volitional formations.",
    fetter: "ignorance,personal existence",
    tags: "volitional formations,views,ignorance,personal existence,sn,sn22-34,sn33",
    id: "sn33.4",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.4.pli": {
    title: "Sa\u1E45kh\u0101raa\xF1\xF1\u0101\u1E47a sutta - Not Knowing Volitional Formations",
    description: "Various kinds of views arise in the world due to not knowing volitional formations, the arising of volitional formations, the cessation of volitional formations, and the practice leading to the cessation of volitional formations.",
    fetter: "ignorance,self-identity view",
    tags: "volitional formations,views,ignorance,self-identity view,sn,sn22-34,sn33",
    id: "sn33.4",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.5.en": {
    title: "Vi\xF1\xF1\u0101\u1E47aa\xF1\xF1\u0101\u1E47a sutta - Not Knowing Consciousness",
    description: "Various kinds of views arise in the world due to not knowing consciousness, the arising of consciousness, the cessation of consciousness, and the practice leading to the cessation of consciousness.",
    fetter: "ignorance,personal existence",
    tags: "consciousness,views,ignorance,personal existence,sn,sn22-34,sn33",
    id: "sn33.5",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.5.pli": {
    title: "Vi\xF1\xF1\u0101\u1E47aa\xF1\xF1\u0101\u1E47a sutta - Not Knowing Consciousness",
    description: "Various kinds of views arise in the world due to not knowing consciousness, the arising of consciousness, the cessation of consciousness, and the practice leading to the cessation of consciousness.",
    fetter: "ignorance,self-identity view",
    tags: "consciousness,views,ignorance,self-identity view,sn,sn22-34,sn33",
    id: "sn33.5",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.6-10.en": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.6.en": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.en#336",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.7.en": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.en#337",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.8.en": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.en#338",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.9.en": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.en#339",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.10.en": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.en#3310",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.6-10.pli": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.6.pli": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.pli#336",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.7.pli": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.pli#337",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.8.pli": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.pli#338",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.9.pli": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.pli#339",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn33.10.pli": {
    title: "R\u016Bpaadassan\u0101disutta pa\xF1caka - The Five Discourses on Not Seeing Form and Other Aggregates",
    description: "Various kinds of views arise in the world due to not seeing the aggregates, the arising of the aggregates, the cessation of the aggregates, and the practice leading to the cessation of the aggregates.",
    fetter: "ignorance",
    tags: "form,feeling,perception,volitional formations,consciousness,views,ignorance,sn,sn22-34,sn33",
    id: "sn33.6-10",
    path: "/sn/sn22-34/sn33/",
    fullPath: "/sn/sn22-34/sn33/sn33.6-10.pli#3310",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn34.1.en": {
    title: "Sam\u0101dhim\u016Blakasam\u0101patti sutta - Attainment Based On Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in attainment based on collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, attainment,sn,sn22-34,sn34",
    id: "sn34.1",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-28T14:41:29.000Z"
  },
  "sn34.1.pli": {
    title: "Sam\u0101dhim\u016Blakasam\u0101patti sutta - Attainment Based On Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in attainment based on collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, attainment,sn,sn22-34,sn34",
    id: "sn34.1",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-28T14:41:29.000Z"
  },
  "sn34.2.en": {
    title: "Sam\u0101dhim\u016Blaka\u1E6Dhiti sutta - Continuity Of Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the continuity of collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, continuity, stability,sn,sn22-34,sn34",
    id: "sn34.2",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-28T14:41:29.000Z"
  },
  "sn34.2.pli": {
    title: "Sam\u0101dhim\u016Blaka\u1E6Dhiti sutta - Continuity Of Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the continuity of collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, continuity, stability,sn,sn22-34,sn34",
    id: "sn34.2",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-28T14:41:29.000Z"
  },
  "sn34.3.en": {
    title: "Sam\u0101dhim\u016Blakavu\u1E6D\u1E6Dh\u0101na sutta - Emergence From Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the emergence from collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, emergence, sn,sn22-34,sn34",
    id: "sn34.3",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-28T14:41:29.000Z"
  },
  "sn34.3.pli": {
    title: "Sam\u0101dhim\u016Blakavu\u1E6D\u1E6Dh\u0101na sutta - Emergence From Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the emergence from collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, emergence, sn,sn22-34,sn34",
    id: "sn34.3",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-28T14:41:29.000Z"
  },
  "sn34.4.en": {
    title: "Sam\u0101dhim\u016Blakakallitasutta - Flexibility in Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the flexibility of collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, flexibility, pliancy, sn, sn22-34, sn34",
    id: "sn34.4",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-30T15:14:30.000Z"
  },
  "sn34.4.pli": {
    title: "Sam\u0101dhim\u016Blakakallitasutta - Flexibility in Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the flexibility of collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, flexibility, pliancy, sn, sn22-34, sn34",
    id: "sn34.4",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-30T15:14:30.000Z"
  },
  "sn34.5.en": {
    title: "Sam\u0101dhim\u016Blaka\u0101ramma\u1E47a sutta - Support for Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the support for collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, support, sn,sn22-34,sn34",
    id: "sn34.5",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-30T15:14:30.000Z"
  },
  "sn34.5.pli": {
    title: "Sam\u0101dhim\u016Blaka\u0101ramma\u1E47a sutta - Support for Collectedness",
    description: "The Buddha describes the four types of meditators based on their skill in collectedness and in the support for collectedness.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "concentration, collectedness, samadhi, meditation, skill, support, sn,sn22-34,sn34",
    id: "sn34.5",
    path: "/sn/sn22-34/",
    updatedTime: "2024-07-30T15:14:30.000Z"
  },
  "sn35.147.en": {
    title: "Aniccanibb\u0101nasapp\u0101ya sutta - Impermanent As Suitable For Realizing Nibb\u0101na",
    description: "The way of practice suitable for realizing Nibb\u0101na is to see the impermanence of the six sense bases and their objects.",
    fetter: "ignorance, personal existence, sensual desire, ill-will",
    tags: "impermanence, realization, Nibb\u0101na, six-sense bases, feelings, pleasant, painful, neither-painful-nor-pleasant, sn, sn35-44, sn35",
    id: "sn35.147",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn35.147.pli": {
    title: "Aniccanibb\u0101nasapp\u0101ya sutta - Impermanent As Suitable For Realizing Nibb\u0101na",
    description: "The way of practice suitable for realizing Nibb\u0101na is to see the impermanence of the six sense bases and their objects.",
    fetter: "ignorance, self-identity view, sensual desire, ill-will",
    tags: "impermanence, realization, Nibb\u0101na, six-sense bases, feelings, pleasant, painful, neither-painful-nor-pleasant, sn, sn35-44, sn35",
    id: "sn35.147",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.148.en": {
    title: "Dukkhanibb\u0101nasapp\u0101ya sutta - Discontentment As Suitable For Realizing Nibb\u0101na",
    description: "The way of practice suitable for realizing Nibb\u0101na is to see the six sense bases and their objects as sources of discontentment.",
    fetter: "ignorance, personal existence, sensual desire, ill-will",
    tags: "discontentment, realization, Nibb\u0101na, six-sense bases, feelings, pleasant, painful, neither-painful-nor-pleasant, sn, sn35-44, sn35",
    id: "sn35.148",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn35.148.pli": {
    title: "Dukkhanibb\u0101nasapp\u0101ya sutta - Discontentment As Suitable For Realizing Nibb\u0101na",
    description: "The way of practice suitable for realizing Nibb\u0101na is to see the six sense bases and their objects as sources of discontentment.",
    fetter: "ignorance, self-identity view, sensual desire, ill-will",
    tags: "discontentment, realization, Nibb\u0101na, six-sense bases, feelings, pleasant, painful, neither-painful-nor-pleasant, sn, sn35-44, sn35",
    id: "sn35.148",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.149.en": {
    title: "Anattanibb\u0101nasapp\u0101ya sutta - Not-self As Suitable For Realizing Nibb\u0101na",
    description: "The way of practice suitable for realizing Nibb\u0101na is to see the six sense bases and their objects as not-self.",
    fetter: "ignorance, personal existence, sensual desire, ill-will",
    tags: "not-self, realization, Nibb\u0101na, six-sense bases, feelings, pleasant, painful, neither-painful-nor-pleasant, sn, sn35-44, sn35",
    id: "sn35.149",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn35.149.pli": {
    title: "Anattanibb\u0101nasapp\u0101ya sutta - Not-self As Suitable For Realizing Nibb\u0101na",
    description: "The way of practice suitable for realizing Nibb\u0101na is to see the six sense bases and their objects as not-self.",
    fetter: "ignorance, self-identity view, sensual desire, ill-will",
    tags: "not-self, realization, Nibb\u0101na, six-sense bases, feelings, pleasant, painful, neither-painful-nor-pleasant, sn, sn35-44, sn35",
    id: "sn35.149",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.234.en": {
    title: "Ud\u0101y\u012B sutta - With Ud\u0101y\u012B",
    description: "The venerable Ud\u0101y\u012B asks the venerable \u0100nanda about the nature of consciousness and the sense bases.",
    fetter: "ignorance",
    tags: "consciousness, sense bases, not-self, body, eye, ear, nose, tongue, body, mind, perception, contact, feeling, craving, clinging, becoming, birth, aging, death, suffering, cessation, path, sn, sn35-44, sn35",
    id: "sn35.234",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.234.pli": {
    title: "Ud\u0101y\u012B sutta - With Ud\u0101y\u012B",
    description: "The venerable Ud\u0101y\u012B asks the venerable \u0100nanda about the nature of consciousness and the sense bases.",
    fetter: "ignorance",
    tags: "consciousness, sense bases, not-self, body, eye, ear, nose, tongue, body, mind, perception, contact, feeling, craving, clinging, becoming, birth, aging, death, suffering, cessation, path, sn, sn35-44, sn35",
    id: "sn35.234",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.26.en": {
    title: "Pa\u1E6Dhamaaparij\u0101nana sutta - Not Fully Understanding",
    description: "Everything, when not thoroughly understood, not fully comprehended, not relinquished through dispassion, and not cleared away, lacks the capability to bring about the end of suffering.",
    fetter: "ignorance,sensual desire,ill-will",
    tags: "suffering, ignorance, sensual desire, ill-will, understanding, comprehension, relinquishment, dispassion, sn, sn35-44, sn35, six-sense bases",
    id: "sn35.26",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-11T09:01:50.000Z"
  },
  "sn35.26.pli": {
    title: "Pa\u1E6Dhamaaparij\u0101nana sutta - Not Fully Understanding",
    description: "Everything, when not thoroughly understood, not fully comprehended, not relinquished through dispassion, and not cleared away, lacks the capability to bring about the end of suffering.",
    fetter: "ignorance,sensual desire,ill-will",
    tags: "suffering, ignorance, sensual desire, ill-will, understanding, comprehension, relinquishment, dispassion, sn, sn35-44, sn35, six-sense bases",
    id: "sn35.26",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.28.en": {
    title: "\u0100ditta sutta - Burning",
    description: "The Buddha explains how the six sense bases and their objects are burning with the fires of passion, aversion, and delusion, and how to become disenchanted, dispassionate, and liberated.",
    fetter: "ignorance,sensual desire,ill-will",
    tags: "suffering, ignorance, sensual desire, ill-will, passion, aversion, delusion, disenchantment, dispassion, liberation, sn, sn35-44, sn35, six-sense bases",
    id: "sn35.28",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-11T09:01:50.000Z"
  },
  "sn35.28.pli": {
    title: "\u0100ditta sutta - Burning",
    description: "The Buddha explains how the six sense bases and their objects are burning with the fires of passion, aversion, and delusion, and how to become disenchanted, dispassionate, and liberated.",
    fetter: "ignorance,sensual desire,ill-will",
    tags: "suffering, ignorance, sensual desire, ill-will, passion, aversion, delusion, disenchantment, dispassion, liberation, sn, sn35-44, sn35, six-sense bases",
    id: "sn35.28",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn35.85.en": {
    title: "Su\xF1\xF1ataloka sutta - Empty Is The World",
    description: "The world is empty of self and what belongs to a self.",
    fetter: "personal existence",
    tags: "emptiness, self, world, eye, ear, nose, tongue, body, mind, consciousness, contact, feeling, sn, sn35",
    id: "sn35.85",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "sn35.85.pli": {
    title: "Su\xF1\xF1ataloka sutta - Empty Is The World",
    description: "The world is empty of self and what belongs to a self.",
    fetter: "self-identity view",
    tags: "emptiness, self, world, eye, ear, nose, tongue, body, mind, consciousness, contact, feeling, sn, sn35",
    id: "sn35.85",
    path: "/sn/sn35-44/sn35/",
    updatedTime: "2024-08-07T13:56:47.000Z"
  },
  "sn38.1.en": {
    title: "Nibb\u0101napa\xF1h\u0101 sutta - A Question On Nibb\u0101na",
    description: "The Noble Eightfold Path is the path and the way for the realization of Nibb\u0101na.",
    fetter: "sensual desire, ill-will, ignorance",
    tags: "Nibb\u0101na, passion, aversion, delusion, noble eightfold path, sn, sn35-44, sn38",
    id: "sn38.1",
    path: "/sn/sn35-44/",
    updatedTime: "2024-08-07T13:48:42.000Z"
  },
  "sn38.1.pli": {
    title: "Nibb\u0101napa\xF1h\u0101 sutta - A Question On Nibb\u0101na",
    description: "The Noble Eightfold Path is the path and the way for the realization of Nibb\u0101na.",
    fetter: "sensual desire, ill-will, ignorance",
    tags: "Nibb\u0101na, passion, aversion, delusion, noble eightfold path, sn, sn35-44, sn38",
    id: "sn38.1",
    path: "/sn/sn35-44/",
    updatedTime: "2024-08-07T13:48:42.000Z"
  },
  "sn43.12.en": {
    title: "Asa\u1E45khata sutta - The Unconditioned",
    description: "The unconditioned is the ending of desire, aversion, and delusion. The 37 factors leading to the unconditioned are described in brief.",
    fetter: "ignorance",
    tags: "unconditioned, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.12",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-09-13T17:56:27.000Z"
  },
  "sn43.12.pli": {
    title: "Asa\u1E45khata sutta - The Unconditioned",
    description: "The unconditioned is the ending of desire, aversion, and delusion. The 37 factors leading to the unconditioned are described in brief.",
    fetter: "ignorance",
    tags: "unconditioned, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.12",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.13.en": {
    title: "Anata sutta - The Uninclined",
    description: "The uninclined is the ending of desire, aversion, and delusion. The 37 factors leading to the uninclined are described in brief.",
    fetter: "ignorance",
    tags: "uninclined, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.13",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-09-13T17:56:27.000Z"
  },
  "sn43.13.pli": {
    title: "Anata sutta - The Uninclined",
    description: "The uninclined is the ending of desire, aversion, and delusion. The 37 factors leading to the uninclined are described in brief.",
    fetter: "ignorance",
    tags: "uninclined, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.13",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.14-43.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.14.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4314",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.15.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4315",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.16.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4316",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.17.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4317",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.18.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4318",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.19.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4319",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.20.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4320",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.21.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4321",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.22.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4322",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.23.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4323",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.24.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4324",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.25.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4325",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.26.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4326",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.27.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4327",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.28.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4328",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.29.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4329",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.30.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4330",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.31.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4331",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.32.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4332",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.33.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4333",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.34.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4334",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.35.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4335",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.36.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4336",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.37.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4337",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.38.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4338",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.39.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4339",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.40.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4340",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.41.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4341",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.42.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4342",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.43.en": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.en#4343",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.14-43.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.14.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4314",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.15.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4315",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.16.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4316",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.17.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4317",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.18.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4318",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.19.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4319",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.20.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4320",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.21.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4321",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.22.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4322",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.23.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4323",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.24.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4324",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.25.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4325",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.26.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4326",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.27.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4327",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.28.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4328",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.29.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4329",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.30.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4330",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.31.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4331",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.32.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4332",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.33.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4333",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.34.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4334",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.35.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4335",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.36.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4336",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.37.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4337",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.38.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4338",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.39.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4339",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.40.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4340",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.41.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4341",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.42.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4342",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.43.pli": {
    title: "An\u0101sav\u0101di sutta - The Taintless",
    description: "Several synonyms for Nibb\u0101na are described - such as, the taintless, the truth, the far shore, the subtle, the hard to see, the unaging, the stable, the non-disintegrating, the signless, the non-proliferation, the peaceful, the deathless, the excellent, the auspicious, the safe, the wearing away of craving, the wonderful, the marvelous, the freedom from calamity, the state free from calamity, Nibb\u0101na, the blameless, dispassion, purity, freedom, the non-clinging, the island, the security, the protection, and the shelter.",
    fetter: "ignorance",
    tags: "taintless, path, tranquility, insight, collectedness, reflection, examination, investigation, mindfulness, body, feelings, mind, mental qualities, right efforts, psychic ability, five faculties, five powers, seven factors of awakening, noble eightfold path, sn, sn35-44, sn43",
    id: "sn43.14-43",
    path: "/sn/sn35-44/sn43/",
    fullPath: "/sn/sn35-44/sn43/sn43.14-43.pli#4343",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn43.44.en": {
    title: "Par\u0101yana sutta - The Ultimate Goal",
    description: "The Buddha describes the ultimate goal and the path leading to the ultimate goal. The ultimate goal is a synonym for Nibb\u0101na.",
    fetter: "ignorance",
    tags: "ultimate goal, path, mindfulness, body, r\u0101ga, dosa, moha, passion, infatuation, lust, aversion, ill-will, hate, hatred, fault, resentment, delusion, illusion, hallucination, misperception, distorted view, sn, sn35-44, sn43",
    id: "sn43.44",
    commentary: "Similar to [SN 43.12](/sn43.12) and [SN 43.13](/sn43.13).",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-09-13T17:46:26.000Z"
  },
  "sn43.44.pli": {
    title: "Par\u0101yana sutta - The Ultimate Goal",
    description: "The Buddha describes the ultimate goal and the path leading to the ultimate goal. The ultimate goal is a synonym for Nibb\u0101na.",
    fetter: "ignorance",
    tags: "ultimate goal, path, mindfulness, body, r\u0101ga, dosa, moha, passion, infatuation, lust, aversion, ill-will, hate, hatred, fault, resentment, delusion, illusion, hallucination, misperception, distorted view, sn, sn35-44, sn43",
    id: "sn43.44",
    path: "/sn/sn35-44/sn43/",
    updatedTime: "2024-09-13T17:46:26.000Z"
  },
  "sn45.1.en": {
    title: "Avijj\u0101 sutta - Ignorance",
    description: "Ignorance is the forerunner in the arising of unwholesome qualities, and wisdom is the forerunner in the arising of wholesome qualities.",
    fetter: "ignorance",
    tags: "ignorance, unwholesome, wholesome, wrong view, right view, wrong intention, right intention, wrong speech, right speech, wrong action, right action, wrong livelihood, right livelihood, wrong effort, right effort, wrong mindfulness, right mindfulness, wrong collectedness, right collectedness, concentration, sn, sn45-56, sn45",
    id: "sn45.1",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.1.pli": {
    title: "Avijj\u0101 sutta - Ignorance",
    description: "Ignorance is the forerunner in the arising of unwholesome qualities, and wisdom is the forerunner in the arising of wholesome qualities.",
    fetter: "ignorance",
    tags: "ignorance, unwholesome, wholesome, wrong view, right view, wrong intention, right intention, wrong speech, right speech, wrong action, right action, wrong livelihood, right livelihood, wrong effort, right effort, wrong mindfulness, right mindfulness, wrong collectedness, right collectedness, concentration, sn, sn45-56, sn45",
    id: "sn45.1",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-08-18T15:28:10.000Z"
  },
  "sn45.18.en": {
    title: "Pa\u1E6Dhamakukku\u1E6D\u0101r\u0101ma sutta - Kuku\u1E6Da's Park (First)",
    description: "The venerable Bhadda asks the venerable \u0100nanda about the wrong spiritual practice.",
    fetter: "ignorance",
    tags: "wrong spiritual practice, wrong view, wrong intention, wrong speech, wrong action, wrong livelihood, wrong effort, wrong mindfulness, wrong collectedness, sn, sn45-56, sn45",
    id: "sn45.18",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.18.pli": {
    title: "Pa\u1E6Dhamakukku\u1E6D\u0101r\u0101ma sutta - Kuku\u1E6Da's Park (First)",
    description: "The venerable Bhadda asks the venerable \u0100nanda about the wrong spiritual practice.",
    fetter: "ignorance",
    tags: "wrong spiritual practice, wrong view, wrong intention, wrong speech, wrong action, wrong livelihood, wrong effort, wrong mindfulness, wrong collectedness, sn, sn45-56, sn45",
    id: "sn45.18",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.19.en": {
    title: "Dutiyakukku\u1E6D\u0101r\u0101ma sutta - Kuku\u1E6Da's Park (Second)",
    description: "The venerable Bhadda asks the venerable \u0100nanda about the right spiritual practice.",
    fetter: "ignorance",
    tags: "right spiritual practice, right view, right intention, right speech, right action, right livelihood, right effort, right mindfulness, right collectedness, sn, sn45-56, sn45",
    id: "sn45.19",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.19.pli": {
    title: "Dutiyakukku\u1E6D\u0101r\u0101ma sutta - Kuku\u1E6Da's Park (Second)",
    description: "The venerable Bhadda asks the venerable \u0100nanda about the right spiritual practice.",
    fetter: "ignorance",
    tags: "right spiritual practice, right view, right intention, right speech, right action, right livelihood, right effort, right mindfulness, right collectedness, sn, sn45-56, sn45",
    id: "sn45.19",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.2.en": {
    title: "Upa\u1E0D\u1E0Dha sutta - Half The Spiritual Life",
    description: "When \u0100nanda says that good friendship is half of the spiritual life, the Buddha corrects him, saying that it is the whole of the spiritual life. The Buddha explains that good friendship is the basis for the development of the Noble Eightfold Path.",
    fetter: "ignorance",
    tags: "friendship, companionship, association, noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.2",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.2.pli": {
    title: "Upa\u1E0D\u1E0Dha sutta - Half The Spiritual Life",
    description: "When \u0100nanda says that good friendship is half of the spiritual life, the Buddha corrects him, saying that it is the whole of the spiritual life. The Buddha explains that good friendship is the basis for the development of the Noble Eightfold Path.",
    fetter: "ignorance",
    tags: "friendship, companionship, association, noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.2",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-08-18T15:28:10.000Z"
  },
  "sn45.27.en": {
    title: "Kumbha sutta - Water Pot",
    description: "The Buddha shares a simile of a water pot without a stand being easily knocked over, and likens it to a mind without support.",
    fetter: "ignorance",
    tags: "mind, support, water pot, sn, sn45, sn45-56",
    id: "sn45.27",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.27.pli": {
    title: "Kumbha sutta - Water Pot",
    description: "The Buddha shares a simile of a water pot without a stand being easily knocked over, and likens it to a mind without support.",
    fetter: "ignorance",
    tags: "mind, support, water pot, sn, sn45, sn45-56",
    id: "sn45.27",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T12:35:37.000Z"
  },
  "sn45.3.en": {
    title: "S\u0101riputta sutta - S\u0101riputta",
    description: "When S\u0101riputta says that good friendship is the whole of the spiritual life, the Buddha agrees, explaining that good friendship is the basis for the development of the Noble Eightfold Path.",
    fetter: "ignorance",
    tags: "friendship, companionship, association, noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.3",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.3.pli": {
    title: "S\u0101riputta sutta - S\u0101riputta",
    description: "When S\u0101riputta says that good friendship is the whole of the spiritual life, the Buddha agrees, explaining that good friendship is the basis for the development of the Noble Eightfold Path.",
    fetter: "ignorance",
    tags: "friendship, companionship, association, noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.3",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.49.en": {
    title: "Kaly\u0101\u1E47amitta sutta - Good Friend",
    description: "The Buddha explains the importance of good friendship in the development and cultivation of the noble eightfold path.",
    fetter: "ignorance",
    tags: "good friendship, noble eightfold path, ignorance, sn, sn45-56, sn45",
    id: "sn45.49",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-08-18T09:28:16.000Z"
  },
  "sn45.49.pli": {
    title: "Kaly\u0101\u1E47amitta sutta - Good Friend",
    description: "The Buddha explains the importance of good friendship in the development and cultivation of the noble eightfold path.",
    fetter: "ignorance",
    tags: "good friendship, noble eightfold path, ignorance, sn, sn45-56, sn45",
    id: "sn45.49",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-08-18T09:28:16.000Z"
  },
  "sn45.50-54.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.50.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.en#4550",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.51.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.en#4551",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.52.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.en#4552",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.53.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.en#4553",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.54.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.en#4554",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.50-54.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, interest, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.50.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, interest, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.pli#4550",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.51.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, interest, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.pli#4551",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.52.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, interest, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.pli#4552",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.53.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, interest, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.pli#4553",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.54.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, interest, self-development, right view, diligence",
    id: "sn45.50",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.50-54.pli#4554",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.55.en": {
    title: "Yonisomanasik\u0101rasampad\u0101 sutta - Accomplishment in Wise Attention",
    description: "The Buddha explains the importance of accomplishment in wise attention in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "wise attention, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, careful attending, right view, collectedness",
    id: "sn45.55",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn45.55.pli": {
    title: "Yonisomanasik\u0101rasampad\u0101 sutta - Accomplishment in Wise Attention",
    description: "The Buddha explains the importance of accomplishment in wise attention in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "wise attention, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, careful attending, right view, collectedness",
    id: "sn45.55",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn45.63.en": {
    title: "Kaly\u0101\u1E47amitta sutta - Good Friend",
    description: "Good friendship is greatly beneficial for the arising, development and extensive cultivation of the Noble Eightfold Path.",
    fetter: "ignorance",
    tags: "good friendship, noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.63",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.63.pli": {
    title: "Kaly\u0101\u1E47amitta sutta - Good Friend",
    description: "Good friendship is greatly beneficial for the arising, development and extensive cultivation of the Noble Eightfold Path.",
    fetter: "ignorance",
    tags: "good friendship, noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.63",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.64-68.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.64.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.en#4564",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.65.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.en#4565",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.66.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.en#4566",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.67.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.en#4567",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.68.en": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.en#4568",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.64-68.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.64.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.pli#4564",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.65.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.pli#4565",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.66.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.pli#4566",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.67.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.pli#4567",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.68.pli": {
    title: "S\u012Blasampad\u0101di suttapa\xF1caka - Five Discourses Beginning With Accomplishment in Virtue",
    description: "The Buddha explains the importance of accomplishment in virtue, aspiration, self-development, view, and diligence in the development and cultivation of the noble eightfold path.",
    fetter: "adherence to rites and rituals,doubt,ignorance",
    tags: "virtue, noble eightfold path, adherence to rites and rituals, sn, sn45-56, sn45, aspiration, self-development, right view, diligence",
    id: "sn45.64-68",
    path: "/sn/sn45-56/sn45/",
    fullPath: "/sn/sn45-56/sn45/sn45.64-68.pli#4568",
    updatedTime: "2024-09-23T13:25:13.000Z"
  },
  "sn45.91.en": {
    title: "Pa\u1E6Dhamap\u0101c\u012Bnaninna sutta - Slanting Eastwards (First)",
    description: "A bhikkhu who develops and cultivates the Noble Eightfold Path slants, slopes, and inclines towards Nibb\u0101na.",
    fetter: "ignorance",
    tags: "noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.91",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn45.91.pli": {
    title: "Pa\u1E6Dhamap\u0101c\u012Bnaninna sutta - Slanting Eastwards (First)",
    description: "A bhikkhu who develops and cultivates the Noble Eightfold Path slants, slopes, and inclines towards Nibb\u0101na.",
    fetter: "ignorance",
    tags: "noble eightfold path, seclusion, dispassion, cessation, relinquishment, sn, sn45-56, sn45",
    id: "sn45.91",
    path: "/sn/sn45-56/sn45/",
    updatedTime: "2024-09-23T15:07:15.000Z"
  },
  "sn46.23.en": {
    title: "\u1E6Ch\u0101niya sutta - Serving As A Basis",
    description: "The Buddha explains how frequently paying attention to certain things can lead to the arising and expansion of hindrances and awakening factors.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness, drowsiness, restlessness, worry, doubt, mindfulness, investigation, energy, joy, tranquility, collectedness, equanimity, hindrances, awakening factors, sn, sn45-56, sn46",
    id: "sn46.23",
    commentary: '| By attending to these things             | there is an arising and expansion of  |\n|:------------------------------------|:-------------------------------|\n| A beautiful mental image: frequently giving careless attention to the sign of beautiful           | Hindrance of sensual desire (passion or lust for sensual pleasures)                |\n| An aversive mental image: frequently giving careless attention to the sign of resistance          | Hindrance of ill-will (aversion, contempt, anger, resentment)                      |\n| Dissatisfaction, laziness, yawning, passing out after a meal, and sluggishness of mind; frequently giving careless attention to these (read [AN 8.80](/an8.80)) | Hindrance of dullness and drowsiness              |\n| An untamed mind: lack of sense restraint, frequently giving careless attention to an unsettled mind	                  | Hindrance of restlessness and worry (agitation and edginess, fidgeting, fiddling, uneasiness)        |\n| Frequently giving careless attention to things that lead to doubt, to confusion, to conflict (read [MN 16](/mn16))                  | Hindrance of doubt                         |\n| Following precepts, applying sense restraint, and practicing breathing-mindfulness meditation (read [MN 107](/mn107)) | Awakening factor of mindfulness                  |\n| Understanding what is wholesome and unwholesome, blamable and blameless, inferior and superior, and dark and bright, learning the teachings of the Buddha with careful attention | Awakening factor of investigation of mental qualities |\n| Taking initiative, persistence, and applying continuous effort (read [AN 8.80](/an8.80)) | Awakening factor of energy |\n| Cultivation of jh\u0101na 1 (read [MN 39](/mn39))              | Awakening factor of joy                          |\n| Cultivation of jh\u0101na 2 "             | Awakening factor of tranquility                          |\n| Cultivation of jh\u0101na 3 "            | Awakening factor of collectedness                          |\n | Cultivation of jh\u0101na 4 "             | Awakening factor of equanimity                          |\n',
    path: "/sn/sn45-56/sn46/",
    updatedTime: "2024-09-14T14:52:51.000Z"
  },
  "sn46.23.pli": {
    title: "\u1E6Ch\u0101niya sutta - Serving As A Basis",
    description: "The Buddha explains how frequently paying attention to certain things can lead to the arising and expansion of hindrances and awakening factors.",
    fetter: "ignorance",
    tags: "sensual desire, ill-will, dullness, drowsiness, restlessness, worry, doubt, mindfulness, investigation, energy, joy, tranquility, collectedness, equanimity, hindrances, awakening factors, sn, sn45-56, sn46",
    id: "sn46.23",
    commentary: '| By attending to these things             | there is arising and expansion of  |\n|:------------------------------------|:-------------------------------|\n| A beautiful mental image: frequently giving careless attention to the sign of beautiful           | Hindrance of sensual desire (passion or lust for sensual pleasures)                |\n| An aversive mental image: frequently giving careless attention to the sign of resistance          | Hindrance of ill-will (aversion, contempt, anger, resentment)                      |\n| Dissatisfaction, laziness, yawning, passing out after a meal, and sluggishness of mind; frequently giving careless attention to these (read [AN 8.80](/an8.80)) | Hindrance of dullness and drowsiness              |\n| An untamed mind: lack of sense restraint, frequently giving careless attention to an unsettled mind	                  | Hindrance of restlessness and worry (agitation and edginess, fidgeting, fiddling, uneasiness)        |\n| Frequently giving careless attention to things that lead to doubt, to confusion, to conflict (read [MN 16](/mn16))                  | Hindrance of doubt                         |\n| Following precepts, applying sense restraint, and practicing breathing-mindfulness meditation (read [MN 107](/mn107)) | Awakening factor of mindfulness                  |\n| Understanding what is wholesome and unwholesome, blamable and blameless, inferior and superior, and dark and bright, learning the teachings of the Buddha with careful attention | Awakening factor of investigation of mental qualities |\n| Taking initiative, persistence, and applying continuous effort (read [AN 8.80](/an8.80)) | Awakening factor of energy |\n| Cultivation of jh\u0101na 1 (read [MN 39](/mn39))              | Awakening factor of joy                          |\n| Cultivation of jh\u0101na 2 "             | Awakening factor of tranquility                          |\n| Cultivation of jh\u0101na 3 "            | Awakening factor of collectedness                          |\n | Cultivation of jh\u0101na 4 "             | Awakening factor of equanimity                          |\n',
    path: "/sn/sn45-56/sn46/",
    updatedTime: "2024-09-14T14:52:51.000Z"
  },
  "sn46.3.en": {
    title: "S\u012Bla sutta - Virtue",
    description: "The Buddha explains the benefits of associating with virtuous bhikkhus and the development of the seven awakening factors.",
    fetter: "ignorance",
    tags: "virtue, bhikkhus, association, seclusion, mindfulness, investigation, energy, persistence, joy, rapture, tranquility, collectedness, concentration, equanimity, mental poise, awakening factors, sn, sn45-56, sn46",
    id: "sn46.3",
    path: "/sn/sn45-56/sn46/",
    updatedTime: "2024-09-14T14:52:51.000Z"
  },
  "sn46.3.pli": {
    title: "S\u012Bla sutta - Virtue",
    description: "The Buddha explains the benefits of associating with virtuous bhikkhus and the development of the seven awakening factors.",
    fetter: "ignorance",
    tags: "virtue, bhikkhus, association, seclusion, mindfulness, investigation, energy, persistence, joy, rapture, tranquility, collectedness, concentration, equanimity, mental poise, awakening factors, sn, sn45-56, sn46",
    id: "sn46.3",
    path: "/sn/sn45-56/sn46/",
    updatedTime: "2024-09-14T14:52:51.000Z"
  },
  "sn46.51.en": {
    title: "\u0100h\u0101ra sutta - Nutriment",
    description: "The Buddha explains the nutriment and the lack of nutriment for the five hindrances and the seven factors of awakening.",
    fetter: "sensual desire,ill-will,restlessness and worry,doubt,adherence to rites and rituals",
    tags: "nutriment, five hindrances, awakening factors, sensual desire, ill-will, restlessness, worry, doubt, mindfulness, investigation of mental qualities, persistence, energy, joy, tranquility, collectedness, equanimity, sn, sn45-56, sn46",
    id: "sn46.51",
    path: "/sn/sn45-56/sn46/",
    updatedTime: "2024-09-14T14:52:51.000Z"
  },
  "sn46.51.pli": {
    title: "\u0100h\u0101ra sutta - Nutriment",
    description: "The Buddha explains the nutriment and the lack of nutriment for the five hindrances and the seven factors of awakening.",
    fetter: "sensual desire,ill-will,restlessness and worry,doubt,adherence to rites and rituals",
    tags: "nutriment, five hindrances, awakening factors, sensual desire, ill-will, restlessness, worry, doubt, mindfulness, investigation of mental qualities, persistence, energy, joy, tranquility, collectedness, equanimity, sn, sn45-56, sn46",
    id: "sn46.51",
    path: "/sn/sn45-56/sn46/",
    updatedTime: "2024-09-14T14:52:51.000Z"
  },
  "sn47.12.en": {
    title: "N\u0101landa sutta - At N\u0101land\u0101",
    description: "S\u0101riputta boldly declares that no ascetic or brahmin has ever been, nor will ever be, more knowledgeable in direct knowing than the Blessed One in full awakening. He acknowledges that he cannot encompass the minds of all the Buddhas, past, future, or present. However, he understands a principle through the Dhamma - all those who become fully awakened do so by abandoning the five hindrances, establishing their minds in the four foundations of mindfulness, and developing the seven factors of awakening.",
    fetter: "ignorance",
    tags: "ignorance, knowledge, direct knowing, confidence, faith, past, future, present, fully enlightened ones, virtue, teaching, wisdom, conduct, liberation, sn, sn45-56, sn47",
    id: "sn47.12",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn47.12.pli": {
    title: "N\u0101landa sutta - At N\u0101land\u0101",
    description: "S\u0101riputta boldly declares that no ascetic or brahmin has ever been, nor will ever be, more knowledgeable in direct knowledge than the Blessed One in full awakening. He acknowledges that he cannot encompass the minds of all the Buddhas, past, future, or present. However, he understands a principle through the Dhamma - all those who become fully awakened do so by abandoning the five hindrances, establishing their minds in the four foundations of mindfulness, and developing the seven factors of awakening.",
    fetter: "ignorance",
    tags: "ignorance, knowledge, direct knowledge, confidence, faith, past, future, present, fully enlightened ones, virtue, teaching, wisdom, conduct, liberation, sn, sn45-56, sn47",
    id: "sn47.12",
    path: "/sn/sn45-56/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn47.13.en": {
    title: "Cunda sutta - Cunda",
    description: "On the passing away of S\u0101riputta, the Buddha advises \u0100nanda to be an island unto himself, with no other refuge, with the Dhamma as his island, with the Dhamma as his refuge, not dependent on another as a refuge.",
    fetter: "doubt",
    tags: "death,safety,sn,sn45-56,sn47,refuge,nibb\u0101na,s\u0101riputta",
    id: "sn47.13",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn47.13.pli": {
    title: "Cunda sutta - Cunda",
    description: "On the passing away of S\u0101riputta, the Buddha advises \u0100nanda to be an island unto himself, with no other refuge, with the Dhamma as his island, with the Dhamma as his refuge, not dependent on another as a refuge.",
    fetter: "doubt",
    tags: "death,safety,sn,sn45-56,sn47,refuge,nibb\u0101na,s\u0101riputta",
    id: "sn47.13",
    path: "/sn/sn45-56/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn47.37.en": {
    title: "Sati sutta - Mindfulness",
    description: "The Buddha explains how a bhikkhu should live with mindfulness and full awareness.",
    fetter: "ignorance",
    tags: "mindfulness, awareness, body, feelings, mind, mental qualities, craving, aversion, dissatisfaction, sn, sn45-56, sn47",
    id: "sn47.37",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-24T06:59:12.000Z"
  },
  "sn47.37.pli": {
    title: "Sati sutta - Mindfulness",
    description: "The Buddha explains how a bhikkhu should live with mindfulness and full awareness.",
    fetter: "ignorance",
    tags: "mindfulness, awareness, body, feelings, mind, mental qualities, craving, aversion, dissatisfaction, sn, sn45-56, sn47",
    id: "sn47.37",
    path: "/sn/sn45-56/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "sn48.10.en": {
    title: "Dutiyavibha\u1E45ga sutta - Analysis of Five Faculties (Second)",
    description: "The Buddha explains the five faculties of faith, energy, mindfulness, collectedness, and wisdom.",
    fetter: "doubt,adherence to rites and rituals",
    tags: "confidence, faith, persistence, energy, mindfulness, collectedness, wisdom, faculties, sn, sn45-56, sn48",
    id: "sn48.10",
    path: "/sn/sn45-56/",
    updatedTime: "2024-09-15T13:51:53.000Z"
  },
  "sn48.10.pli": {
    title: "Dutiyavibha\u1E45ga sutta - Analysis of Five Faculties (Second)",
    description: "The Buddha explains the five faculties of faith, energy, mindfulness, collectedness, and wisdom.",
    fetter: "doubt,adherence to rites and rituals",
    tags: "confidence, faith, persistence, mindfulness, collectedness, wisdom, faculties, sn, sn45-56, sn48",
    id: "sn48.10",
    path: "/sn/sn45-56/",
    updatedTime: "2024-09-15T13:51:53.000Z"
  },
  "sn48.18.en": {
    title: "Pa\u1E6Dipanna sutta - Practicing",
    description: "One who has developed the five faculties is an Arahant. Those who are lesser in the development of these faculties are practicing for the realization of the fruit of Arahantship.",
    fetter: "doubt, ignorance",
    tags: "faith, persistence, energy, mindfulness, collectedness, concentration, wisdom, sn, sn48",
    id: "sn48.18",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-05T13:46:53.000Z"
  },
  "sn48.18.pli": {
    title: "Pa\u1E6Dipanna sutta - Practicing",
    description: "One who has developed the five faculties is an Arahant. Those who are lesser in the development of these faculties are practicing for the realization of the fruit of Arahantship.",
    fetter: "doubt, ignorance",
    tags: "faith, persistence, energy, mindfulness, collectedness, concentration, wisdom, sn, sn48",
    id: "sn48.18",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-05T13:46:53.000Z"
  },
  "sn48.53.en": {
    title: "Sekhasutta - Trainee",
    description: "The Buddha explains how a trainee and an arahant understand their respective attainments.",
    fetter: "doubt",
    tags: "trainee, arahant, confidence, faith, persistence, energy, mindfulness, collectedness, concentration, six faculties, wisdom, sn, sn48",
    id: "sn48.53",
    path: "/sn/sn45-56/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "sn48.53.pli": {
    title: "Sekhasutta - Trainee",
    description: "The Buddha explains how a trainee and an arahant understand their respective attainments.",
    fetter: "doubt",
    tags: "trainee, arahant, confidence, faith, persistence, energy, mindfulness, collectedness, concentration, six faculties, wisdom, sn, sn48",
    id: "sn48.53",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-05T13:46:53.000Z"
  },
  "sn51.1.en": {
    title: "Ap\u0101ra sutta - From The Near Shore",
    description: "Developing the four bases of psychic ability can lead from the near shore to the farther shore.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.1",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.1.pli": {
    title: "Ap\u0101ra sutta - From The Near Shore",
    description: "Developing the four bases of psychic ability can lead from the near shore to the farther shore.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.1",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.10.en": {
    title: "Cetiya sutta - Shrine",
    description: "The Buddha could live for an aeon due to his mastery of the four bases of psychic ability, but Ananda is unable to comprehend and the Buddha then gives up the life force at the C\u0101p\u0101la Shrine.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.10",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "sn51.10.pli": {
    title: "Cetiya sutta - Shrine",
    description: "The Buddha could live for an aeon due to his mastery of the four bases of psychic ability, but Ananda is unable to comprehend and the Buddha then gives up the life force at the C\u0101p\u0101la Shrine.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.10",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.11.en": {
    title: "Pubba sutta - Before",
    description: "The Buddha recounts the inquiry that led to the development of the four bases of psychic ability before his full awakening.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.11",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.11.pli": {
    title: "Pubba sutta - Before",
    description: "The Buddha recounts the inquiry that led to the development of the four bases of psychic ability before his full awakening.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.11",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.12.en": {
    title: "Mahapphala sutta - Of Great Fruit",
    description: "Developing the four bases of psychic ability can lead to various kinds of psychic abilities and the realization of the taintless liberation of mind.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.12",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.12.pli": {
    title: "Mahapphala sutta - Of Great Fruit",
    description: "Developing the four bases of psychic ability can lead to various kinds of psychic abilities and the realization of the taintless liberation of mind.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.12",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.13.en": {
    title: "Chandasam\u0101dhi sutta - Collectedness Arising From Aspiration",
    description: "An analysis of the four bases of psychic ability that are endowed with collectedness arising from aspiration, energy, mind, and investigation.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.13",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.13.pli": {
    title: "Chandasam\u0101dhi sutta - Collectedness Arising From Aspiration",
    description: "An analysis of the four bases of psychic ability that are endowed with collectedness arising from aspiration, energy, mind, and investigation.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.13",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.15.en": {
    title: "U\u1E47\u1E47\u0101bhabr\u0101hma\u1E47a sutta - The Brahmin U\u1E47\u1E47\u0101bha",
    description: "\u0100nanda explains to the brahmin U\u1E47\u1E47\u0101bha how desire is abandoned by developing the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, desire, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.15",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "sn51.15.pli": {
    title: "U\u1E47\u1E47\u0101bhabr\u0101hma\u1E47a sutta - The Brahmin U\u1E47\u1E47\u0101bha",
    description: "\u0100nanda explains to the brahmin U\u1E47\u1E47\u0101bha how desire is abandoned by developing the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, desire, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.15",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.16.en": {
    title: "Pa\u1E6Dhamasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (First)",
    description: "Whether in the past, future, or at present, any ascetics or brahmins who are mighty and powerful have attained such might and power through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, ascetic, brahmin, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.16",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.16.pli": {
    title: "Pa\u1E6Dhamasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (First)",
    description: "Any ascetics or brahmins who are mighty and powerful have attained such might and power through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, ascetic, brahmin, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.16",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.17.en": {
    title: "Dutiyasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (Second)",
    description: "Whether in the past, future, or at present, any ascetics or brahmins who are experiencing various kinds of psychic abilities have attained such abilities through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, ascetic, brahmin, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.17",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.17.pli": {
    title: "Dutiyasama\u1E47abr\u0101hma\u1E47a sutta - Ascetics and Brahmins (Second)",
    description: "Whether in the past, future, or at present, any ascetics or brahmins who are experiencing various kinds of psychic abilities have attained such abilities through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, ascetic, brahmin, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.17",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.18.en": {
    title: "Bhikkhu sutta - A Bhikkhu",
    description: "Through the development and frequent practice of the four bases of psychic ability, a bhikkhu realizes the taintless liberation of mind and liberation by wisdom.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.18",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.18.pli": {
    title: "Bhikkhu sutta - A Bhikkhu",
    description: "Through the development and frequent practice of the four bases of psychic ability, a bhikkhu realizes the taintless liberation of mind and liberation by wisdom.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.18",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.19.en": {
    title: "Iddh\u0101didesan\u0101 sutta - A Teaching on Psychic Abilities",
    description: "The Buddha teaches about psychic ability, the basis of psychic ability, the development of the bases of psychic ability, and the path leading to the development of the bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, noble eightfold path, sn, sn45-56, sn51",
    id: "sn51.19",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.19.pli": {
    title: "Iddh\u0101didesan\u0101 sutta - A Teaching on Psychic Abilities",
    description: "The Buddha teaches about psychic ability, the basis of psychic ability, the development of the bases of psychic ability, and the path leading to the development of the bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, noble eightfold path, sn, sn45-56, sn51",
    id: "sn51.19",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.2.en": {
    title: "Viraddha sutta - Neglected",
    description: "For whomever the four bases of psychic ability are neglected, the noble path leading to the complete cessation of suffering is also neglected.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.2",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.2.pli": {
    title: "Viraddha sutta - Neglected",
    description: "For whomever the four bases of psychic ability are neglected, the noble path leading to the complete cessation of suffering is also neglected.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.2",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.20.en": {
    title: "Vibha\u1E45ga sutta - Analysis Of The Four Bases Of Psychic Ability",
    description: "A detailed analysis of the four bases of psychic ability - collectedness arising from aspiration, energy, purification of mind, and investigation.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, analysis, sn, sn45-56, sn51",
    id: "sn51.20",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-09-15T13:51:53.000Z"
  },
  "sn51.20.pli": {
    title: "Vibha\u1E45ga sutta - Analysis Of The Four Bases Of Psychic Ability",
    description: "A detailed analysis of the four bases of psychic ability - collectedness arising from aspiration, energy, purification of mind, and investigation.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, mind, investigation, reflection, close examination, analysis, sn, sn45-56, sn51",
    id: "sn51.20",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.3.en": {
    title: "Ariya sutta - Noble",
    description: "The four bases of psychic ability are noble and lead to liberation.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.3",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.3.pli": {
    title: "Ariya sutta - Noble",
    description: "The four bases of psychic ability are noble and lead to liberation.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.3",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.31.en": {
    title: "Moggall\u0101na sutta - Moggall\u0101na",
    description: "The Buddha explains how Moggall\u0101na became so mighty and powerful through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "psychic ability, Moggall\u0101na, spiritual power, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, analysis, sn, sn45-56, sn51",
    id: "sn51.31",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.31.pli": {
    title: "Moggall\u0101na sutta - Moggall\u0101na",
    description: "The Buddha explains how Moggall\u0101na became so mighty and powerful through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "psychic ability, Moggall\u0101na, spiritual power, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, analysis, sn, sn45-56, sn51",
    id: "sn51.31",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-11T05:28:32.000Z"
  },
  "sn51.4.en": {
    title: "Nibbid\u0101 sutta - Disenchantment",
    description: "When the four bases of psychic ability are developed and frequently practiced, they lead to complete disenchantment, dispassion, cessation, tranquility, direct knowing, full awakening, and Nibb\u0101na.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.4",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.4.pli": {
    title: "Nibbid\u0101 sutta - Disenchantment",
    description: "When the four bases of psychic ability are developed and frequently practiced, they lead to complete disenchantment, dispassion, cessation, tranquility, direct knowledge, full awakening, and Nibb\u0101na.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.4",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.5.en": {
    title: "Iddhipadesa sutta - Limited Psychic Ability",
    description: "Whoever in the past, future, or present produces psychic abilities, all of them do so through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.5",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.5.pli": {
    title: "Iddhipadesa sutta - Limited Psychic Ability",
    description: "Whether in the past, future, or at present, it is the developing and frequently practicing the four bases of psychic ability that leads one to produce psychic abilities.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.5",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.6.en": {
    title: "Samatta sutta",
    description: "Whoever in the past, future, or present produces the highest psychic abilities, all of them do so through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.6",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.6.pli": {
    title: "Samatta sutta",
    description: "Whoever in the past, future, or present produces the highest psychic abilities, all of them do so through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.6",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.7.en": {
    title: "Bhikkhu sutta - Bhikkhu",
    description: "Whoever attains the taint-free release of mind and release by wisdom, does so through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.7",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.7.pli": {
    title: "Bhikkhu sutta - Bhikkhu",
    description: "Whoever attains the taint-free release of mind and release by wisdom, does so through the development and frequent practice of the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.7",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.8.en": {
    title: "Buddha sutta - Buddha",
    description: "It is because he has developed and frequently practiced these four bases of psychic ability that the Tath\u0101gata is called 'the Arahant, the Perfectly Enlightened One.'",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.8",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.8.pli": {
    title: "Buddha sutta - Buddha",
    description: "It is because he has developed and frequently practiced these four bases of psychic ability that the Tath\u0101gata is called 'the Arahant, the Perfectly Enlightened One.'",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.8",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn51.86.en": {
    title: "86 - Higher Fetters",
    description: "Develop the four bases of psychic ability for the direct knowing, full understanding, complete exhaustion, and abandonment of the five higher fetters.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, higher fetters, sn, sn45-56, sn51",
    id: "sn51.86",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn51.86.pli": {
    title: "86 - Higher Fetters",
    description: "Develop the four bases of psychic ability for the direct knowledge, full understanding, complete exhaustion, and abandonment of the five higher fetters.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, higher fetters, sn, sn45-56, sn51",
    id: "sn51.86",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:59:17.000Z"
  },
  "sn51.9.en": {
    title: "\xD1\u0101\u1E47a sutta - Insight",
    description: "Vision, insight, wisdom, true understanding and clarity arose in the Buddha regarding the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.9",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-17T21:27:26.000Z"
  },
  "sn51.9.pli": {
    title: "\xD1\u0101\u1E47a sutta - Insight",
    description: "Vision, insight, wisdom, true understanding and clarity arose in the Buddha regarding the four bases of psychic ability.",
    fetter: "desire for form, desire for formless, conceit, restlessness, ignorance",
    tags: "spiritual power, psychic ability, success, collectedness, aspiration, persistence, energy, mind, investigation, reflection, close examination, sn, sn45-56, sn51",
    id: "sn51.9",
    path: "/sn/sn45-56/sn51/",
    updatedTime: "2024-08-07T12:20:10.000Z"
  },
  "sn53.1-12.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.1.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#531",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.2.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#532",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.3.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#533",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.4.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#534",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.5.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#535",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.6.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#536",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.7.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#537",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.8.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#538",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.9.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#539",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.10.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#5310",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.11.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#5311",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.12.en": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.en#5312",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.1-12.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.1.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#531",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.2.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#532",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.3.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#533",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.4.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#534",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.5.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#535",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.6.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#536",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.7.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#537",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.8.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#538",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.9.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#539",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.10.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#5310",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.11.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#5311",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn53.12.pli": {
    title: "Jh\u0101n\u0101di sutta - Jh\u0101nas And Etc.",
    description: "The Buddha describes the cultivation of four jh\u0101nas as leading to Nibb\u0101na.",
    fetter: "adherence to rites and rituals",
    tags: "jhanas, reflection, examination, mindfulness, ganges, sn, sn45-56, sn53",
    id: "sn53.1-12",
    path: "/sn/sn45-56/",
    fullPath: "/sn/sn45-56/sn53.1-12.pli#5312",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "sn54.13.en": {
    title: "Pa\u1E6Dhama\u0101nanda sutta - With \u0100nanda (First)",
    description: "The Buddha explains the development of mindfulness of breathing and its benefits in fulfilling the four establishments of mindfulness, the seven factors of awakening, and clear knowing and release.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn54, mindfulness of breathing, mindfulness, body, feelings, mind, mental qualities, seven factors of awakening, wisdom, liberation",
    id: "sn54.13",
    path: "/sn/sn45-56/",
    updatedTime: "2024-09-13T17:56:27.000Z"
  },
  "sn54.13.pli": {
    title: "Pa\u1E6Dhama\u0101nanda sutta - With \u0100nanda (First)",
    description: "The Buddha explains the development of mindfulness of breathing and its benefits in fulfilling the four establishments of mindfulness, the seven factors of awakening, and clear knowing and release.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn54, mindfulness of breathing, mindfulness, body, feelings, mind, mental qualities, seven factors of awakening, wisdom, liberation",
    id: "sn54.13",
    path: "/sn/sn45-56/",
    updatedTime: "2024-09-13T17:46:26.000Z"
  },
  "sn55.1.en": {
    title: "Cakkavattir\u0101ja sutta - The Wheel-Turning Monarch",
    description: "The Buddha explains that even a Wheel-Turning Monarch, if not endowed with four qualities, is not freed from hell, the animal realm, the ghost realm, and the lower realms. On the other hand, a noble disciple, endowed with four qualities, is freed from these states.",
    fetter: "doubt",
    tags: "confidence, faith, virtue, sangha, noble virtues, lower realms, sn, sn45-56, sn55",
    id: "sn55.1",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.1.pli": {
    title: "Cakkavattir\u0101ja sutta - The Wheel-Turning Monarch",
    description: "The Buddha explains that even a Wheel-Turning Monarch, if not endowed with four qualities, is not freed from hell, the animal realm, the ghost realm, and the lower realms. On the other hand, a noble disciple, endowed with four qualities, is freed from these states.",
    fetter: "doubt",
    tags: "confidence, faith, virtue, sangha, noble virtues, lower realms, sn, sn45-56, sn55",
    id: "sn55.1",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.31.en": {
    title: "Pa\u1E6Dhamapu\xF1\xF1\u0101bhisanda sutta - Streams of Merit (First)",
    description: "The Buddha describes the four streams of merit, outflows of good, and supports for ease. The fourth quality is virtue.",
    fetter: "doubt",
    tags: "merit, confidence, Buddha, Dhamma, Sangha, virtues, sn, sn45-56, sn55",
    id: "sn55.31",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.31.pli": {
    title: "Pa\u1E6Dhamapu\xF1\xF1\u0101bhisanda sutta - Streams of Merit (First)",
    description: "The Buddha describes the four streams of merit, outflows of good, and supports for ease. The fourth quality is virtue.",
    fetter: "doubt",
    tags: "merit, confidence, Buddha, Dhamma, Sangha, virtues, sn, sn45-56, sn55",
    id: "sn55.31",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.32.en": {
    title: "Dutiyapu\xF1\xF1\u0101bhisanda sutta - Streams of Merit (Second)",
    description: "The Buddha describes the four streams of merit, outflows of good, and supports for ease. The fourth quality is generosity.",
    fetter: "doubt",
    tags: "merit, confidence, Buddha, Dhamma, Sangha, generosity, sn, sn45-56, sn55",
    id: "sn55.32",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.32.pli": {
    title: "Dutiyapu\xF1\xF1\u0101bhisanda sutta - Streams of Merit (Second)",
    description: "The Buddha describes the four streams of merit, outflows of good, and supports for ease. The fourth quality is generosity.",
    fetter: "doubt",
    tags: "merit, confidence, Buddha, Dhamma, Sangha, generosity, sn, sn45-56, sn55",
    id: "sn55.32",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.33.en": {
    title: "Tatiyapu\xF1\xF1\u0101bhisanda sutta - Streams of Merit (Third)",
    description: "The Buddha describes the four streams of merit, outflows of good, and supports for ease. The fourth quality is wisdom.",
    fetter: "doubt",
    tags: "merit, confidence, Buddha, Dhamma, Sangha, wisdom, sn, sn45-56, sn55",
    id: "sn55.33",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.33.pli": {
    title: "Tatiyapu\xF1\xF1\u0101bhisanda sutta - Streams of Merit (Third)",
    description: "The Buddha describes the four streams of merit, outflows of good, and supports for ease. The fourth quality is wisdom.",
    fetter: "doubt",
    tags: "merit, confidence, Buddha, Dhamma, Sangha, wisdom, sn, sn45-56, sn55",
    id: "sn55.33",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.4.en": {
    title: "Pa\u1E6Dhamas\u0101riputta sutta - With S\u0101riputta (First)",
    description: "The venerable \u0100nanda asks the venerable S\u0101riputta about the qualities that make a person a stream-enterer, no longer subject to downfall, fixed in destiny, and headed for full awakening.",
    fetter: "doubt",
    tags: "stream-enterer, faith, confidence, Buddha, Dhamma, Sangha, virtues, s\u0101riputta, sn, sn45-56, sn55",
    id: "sn55.4",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.4.pli": {
    title: "Pa\u1E6Dhamas\u0101riputta sutta - With S\u0101riputta (First)",
    description: "The venerable \u0100nanda asks the venerable S\u0101riputta about the qualities that make a person a stream-enterer, no longer subject to downfall, fixed in destiny, and headed for full awakening.",
    fetter: "doubt",
    tags: "stream-enterer, faith, confidence, Buddha, Dhamma, Sangha, virtues, s\u0101riputta, sn, sn45-56, sn55",
    id: "sn55.4",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.44.en": {
    title: "Pa\u1E6Dhamamahaddhanasutta - Great Wealth (First)",
    description: "A disciple of the noble ones endowed with four qualities is called 'wealthy, of great wealth, of great possessions.'",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, sn, sn45-56, sn55",
    id: "sn55.44",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-11T07:58:02.000Z"
  },
  "sn55.44.pli": {
    title: "Pa\u1E6Dhamamahaddhanasutta - Great Wealth (First)",
    description: "A disciple of the noble ones endowed with four qualities is called 'wealthy, of great wealth, of great possessions.'",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, sn, sn45-56, sn55",
    id: "sn55.44",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-11T07:58:02.000Z"
  },
  "sn55.45.en": {
    title: "Dutiyamahaddhana sutta - Great Wealth (Second)",
    description: "A disciple of the noble ones endowed with four qualities is called 'wealthy, of great wealth, of great possessions, of great fame.'",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, fame, sn, sn45-56, sn55",
    id: "sn55.45",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-11T07:58:02.000Z"
  },
  "sn55.45.pli": {
    title: "Dutiyamahaddhana sutta - Great Wealth (Second)",
    description: "A disciple of the noble ones endowed with four qualities is called 'wealthy, of great wealth, of great possessions, of great fame.'",
    fetter: "doubt",
    tags: "confidence, Buddha, Dhamma, Sangha, virtues, wealth, possessions, fame, sn, sn45-56, sn55",
    id: "sn55.45",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-11T07:58:02.000Z"
  },
  "sn55.5.en": {
    title: "Dutiyas\u0101riputta sutta - With S\u0101riputta (Second)",
    description: "The Buddha asks S\u0101riputta about the four factors of stream-entry, what the stream is, and who is a stream-enterer.",
    fetter: "doubt",
    tags: "stream-entry, stream, stream-enterer, wise attention, Noble Eightfold Path, sot\u0101panna, s\u0101riputta, sn, sn45-56, sn55",
    id: "sn55.5",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn55.5.pli": {
    title: "Dutiyas\u0101riputta sutta - With S\u0101riputta (Second)",
    description: "The Buddha asks S\u0101riputta about the four factors of stream-entry, what the stream is, and who is a stream-enterer.",
    fetter: "doubt",
    tags: "stream-entry, stream, stream-enterer, wise attention, Noble Eightfold Path, sot\u0101panna, s\u0101riputta, sn, sn45-56, sn55",
    id: "sn55.5",
    path: "/sn/sn45-56/sn55/",
    updatedTime: "2024-08-09T15:52:15.000Z"
  },
  "sn56.11.en": {
    title: "Dhammacakkappavattana sutta - Setting in Motion of the Wheel of Dhamma",
    description: "The Buddha's first discourse to the group of five bhikkhus at the Deer Park in Isipatana, near Varanasi. The discourse explains the Four Noble Truths and the Noble Eightfold Path in brief. It ends with the realization of the first bhikkhu, Venerable Konda\xF1\xF1a.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, wheel of dhamma, four noble truths, noble eightfold path, deer park, first discourse",
    id: "sn56.11",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-30T03:43:02.000Z"
  },
  "sn56.11.pli": {
    title: "Dhammacakkappavattana sutta - Setting in Motion of the Wheel of Dhamma",
    description: "The Buddha's first discourse to the group of five bhikkhus at the Deer Park in Isipatana, near Varanasi. The discourse explains the Four Noble Truths and the Noble Eightfold Path in brief. It ends with the realization of the first bhikkhu, Venerable Konda\xF1\xF1a.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, wheel of dhamma, four noble truths, noble eightfold path, deer park, first discourse",
    id: "sn56.11",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-18T15:28:10.000Z"
  },
  "sn56.20.en": {
    title: "Tatha sutta - True",
    description: "The Buddha describes the Four Noble Truths in brief.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, four noble truths, effort",
    id: "sn56.20",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.20.pli": {
    title: "Tatha sutta - True",
    description: "The Buddha describes the Four Noble Truths in brief.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, four noble truths, effort",
    id: "sn56.20",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.21.en": {
    title: "Pa\u1E6Dhamako\u1E6Dig\u0101ma sutta - At Ko\u1E6Di Village (First)",
    description: "The Buddha describes the wandering in samsara due to not fully understanding and penetrating the Four Noble Truths.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, four noble truths, samsara, transmigration, ignorance",
    id: "sn56.21",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.21.pli": {
    title: "Pa\u1E6Dhamako\u1E6Dig\u0101ma sutta - At Ko\u1E6Di Village (First)",
    description: "The Buddha describes the wandering in samsara due to not fully understanding and penetrating the Four Noble Truths.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, four noble truths, samsara, transmigration, ignorance",
    id: "sn56.21",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.24.en": {
    title: "Arahanta sutta - Arahants",
    description: "The Arahants of the past, present, and future have truly understood the Four Noble Truths.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, four noble truths, effort, arahant, ignorance",
    id: "sn56.24",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.24.pli": {
    title: "Arahanta sutta - Arahants",
    description: "The Arahants of the past, present, and future have truly understood the Four Noble Truths.",
    fetter: "ignorance",
    tags: "sn, sn45-56, sn56, four noble truths, effort, arahant, ignorance",
    id: "sn56.24",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.38.en": {
    title: "Second Discourse on the Sun",
    description: "As long as sun and moon do not arise in the world, there is complete darkness. Similarly, as long as the Buddha has not arisen in the world, there is complete darkness, dense darkness.",
    fetter: "ignorance,doubt",
    tags: "sn,sn45-56,sn56,buddha,confidence,doubt,four noble truths",
    id: "sn56.38",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "sn56.38.pli": {
    title: "Dutiyas\u016Briya sutta - Second Discourse on the Sun",
    description: "As long as sun and moon do not arise in the world, there is complete darkness. Similarly, as long as the Buddha has not arisen in the world, there is complete darkness, dense darkness.",
    fetter: "ignorance,doubt",
    tags: "sn,sn45-56,sn56,buddha,confidence,doubt,four noble truths",
    id: "sn56.38",
    path: "/sn/sn45-56/sn56/",
    updatedTime: "2024-08-06T14:57:03.000Z"
  },
  "snp1.8.en": {
    title: "Metta sutta - Loving-kindness",
    description: "Verses on the way of practice to peace through the cultivation of loving-kindness for all beings without an exception and at all times whether one is standing, walking, sitting, or lying down.",
    fetter: "ill-will,sensual desire",
    tags: "snp, snp1,loving-kindness,ill-will,sensual desire",
    id: "snp1.8",
    path: "/snp/snp1/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp1.8.pli": {
    title: "Metta sutta - Loving-kindness",
    description: "Verses on the way of practice to peace through the cultivation of loving-kindness for all beings without an exception and at all times whether one is standing, walking, sitting, or lying down.",
    fetter: "ill-will,sensual desire",
    tags: "snp, snp1,loving-kindness,ill-will,sensual desire",
    id: "snp1.8",
    path: "/snp/snp1/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.1.en": {
    title: "Desires",
    description: "In this teaching, the Buddha is succintly sharing the allure and the drawbacks of desiring pleasure.",
    fetter: "sensual desire",
    tags: "snp,snp4,sensual desire",
    id: "snp4.1",
    path: "/snp/snp4/",
    updatedTime: "2024-07-13T10:38:00.000Z"
  },
  "snp4.15.en": {
    title: "Fear arises from harm",
    description: "The Buddha shares in poignant terms his observations on the agitation all beings experience which led to his urgency to awaken. He then shares on the path to awakening and describes the dwelling of an awakened being.",
    fetter: "doubt,ignorance",
    tags: "snp,snp4,fear,conflict,wisdom,practice",
    id: "snp4.15",
    path: "/snp/snp4/",
    updatedTime: "2024-07-13T10:38:00.000Z"
  },
  "snp4.15.pli": {
    title: "Attada\u1E47\u1E0Da sutta - Fear arises from harm",
    description: "The Buddha shares in poignant terms his observations on the agitation all beings experience which led to his urgency to awaken. He then shares on the path to awakening and describes the dwelling of an awakened being.",
    fetter: "doubt,ignorance",
    tags: "snp,snp4,fear,conflict,wisdom,practice",
    id: "snp4.15",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.2.en": {
    title: "Cave",
    description: "Eight verses on overcoming the mire of delusion by avoiding attachment to sensory pleasures, discerning their causes, and practicing for being free of 'mine'.",
    fetter: "ignorance,sensual desire",
    tags: "snp, snp4,ignorance,sensual desire,",
    id: "snp4.2",
    path: "/snp/snp4/",
    updatedTime: "2024-07-13T10:38:00.000Z"
  },
  "snp4.3.en": {
    title: "Du\u1E6D\u1E6Dha\u1E6D\u1E6Dhaka sutta - Corrupt",
    description: "The Buddha explains the nature of a corrupted mind and the consequences of holding onto views in these verses.",
    fetter: "personal existence, conceit",
    tags: "snp,snp4,views,corruption,conceit,dispute,attachment,arahant",
    id: "snp4.3",
    path: "/snp/snp4/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "snp4.3.pli": {
    title: "Du\u1E6D\u1E6Dha\u1E6D\u1E6Dhaka sutta - Corrupt",
    description: "The Buddha explains the nature of a corrupted mind and the consequences of holding onto views in these verses.",
    fetter: "self-identity view, conceit",
    tags: "snp,snp4,views,corruption,conceit,dispute,attachment,arahant",
    id: "snp4.3",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.4.en": {
    title: "Suddha\u1E6D\u1E6Dhaka sutta - Pure",
    description: "The Buddha describes some of the wrong views on attaining purity as well as the the state of an Arahant in these verses.",
    fetter: "adherence to rites and rituals",
    tags: "snp,snp4,precepts,purity,arahant",
    id: "snp4.4",
    path: "/snp/snp4/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "snp4.4.pli": {
    title: "Suddha\u1E6D\u1E6Dhaka sutta - Pure",
    description: "The Buddha describes some of the wrong views on attaining purity as well as the the state of an Arahant in these verses.",
    fetter: "adherence to rites and rituals",
    tags: "snp,snp4,precepts,purity,arahant",
    id: "snp4.4",
    path: "/snp/snp4/",
    updatedTime: "2024-08-30T15:15:31.000Z"
  },
  "snp4.5.en": {
    title: "Parama\u1E6D\u1E6Dhaka sutta - Ultimate",
    description: "The Buddha advises against engaging in views deemed the ultimate, as it leads to disputes and clinging to views and doesn't lead to the cessation of suffering.",
    fetter: "conceit,personal existence,ignorance",
    tags: "snp,snp4,disputes,views,ultimate,conceit,clinging",
    id: "snp4.5",
    path: "/snp/snp4/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "snp4.5.pli": {
    title: "Parama\u1E6D\u1E6Dhaka sutta - Ultimate",
    description: "The Buddha advises against engaging in views deemed the ultimate, as it leads to disputes and clinging to views and doesn't lead to the cessation of suffering.",
    fetter: "conceit,self-identity view,ignorance",
    tags: "snp,snp4,disputes,views,ultimate,conceit,clinging",
    id: "snp4.5",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.6.en": {
    title: "Jar\u0101 sutta - Ageing",
    description: "The Buddha explains the nature of ageing and the impermanence of life in these verses, as well as the state of an Arahant.",
    fetter: "sensual desire,conceit,personal existence",
    tags: "snp,snp4,ageing,impermanence,attachment,death,sensual desire,conceit,personal existence,arahant",
    id: "snp4.6",
    path: "/snp/snp4/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "snp4.6.pli": {
    title: "Jar\u0101 sutta - Ageing",
    description: "The Buddha explains the nature of ageing and the impermanence of life in these verses, as well as the state of an Arahant.",
    fetter: "sensual desire,conceit,self-identity view",
    tags: "snp,snp4,ageing,impermanence,attachment,death,sensual desire,conceit,self-identity view,arahant",
    id: "snp4.6",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.7.en": {
    title: "Tissametteyya sutta - To Tissa Metteyya",
    description: "The Buddha advises Tissa Metteyya on the dangers of engaging in sexual activity and the benefits of solitary conduct.",
    fetter: "sensual desire,conceit",
    tags: "snp,snp4,sensual desire,sexual activity,conceit,seclusion",
    id: "snp4.7",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.7.pli": {
    title: "Tissametteyya sutta - To Tissa Metteyya",
    description: "The Buddha advises Tissa Metteyya on the dangers of engaging in sexual activity and the benefits of solitary conduct.",
    fetter: "sensual desire,conceit",
    tags: "snp,snp4,sensual desire,sexual activity,conceit,seclusion",
    id: "snp4.7",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "snp4.8.en": {
    title: "Pas\u016Bra sutta - To Pas\u016Bra",
    description: "The Buddha advises Pas\u016Bra on the futility of engaging in debates and the dangers of becoming conceited.",
    fetter: "conceit,personal existence",
    tags: "snp,snp4,debate,conceit,pride,purity",
    id: "snp4.8",
    path: "/snp/snp4/",
    updatedTime: "2024-08-13T15:41:13.000Z"
  },
  "snp4.8.pli": {
    title: "Pas\u016Bra sutta - To Pas\u016Bra",
    description: "The Buddha advises Pas\u016Bra on the futility of engaging in debates and the dangers of becoming conceited.",
    fetter: "conceit,self-identity views",
    tags: "snp,snp4,debate,conceit,pride,purity",
    id: "snp4.8",
    path: "/snp/snp4/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud1.1.en": {
    title: "Pa\u1E6Dhamabodhi sutta - Upon Awakening (First)",
    description: "The Buddha contemplates dependent co-arising in forward order just after his awakening.",
    fetter: "ignorance",
    tags: "ud,ud1,awakening,dependent origination,dependent co-arising,wise attention,ignorance",
    id: "ud1.1",
    path: "/ud/ud1/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud1.1.pli": {
    title: "Pa\u1E6Dhamabodhi sutta - Upon Awakening (First)",
    description: "The Buddha contemplates dependent co-arising in forward order just after his awakening.",
    fetter: "ignorance",
    tags: "ud,ud1,awakening,dependent origination, dependent co-arising,wise attention,ignorance",
    id: "ud1.1",
    path: "/ud/ud1/",
    updatedTime: "2024-08-02T13:12:23.000Z"
  },
  "ud1.2.en": {
    title: "Dutiyabodhi sutta - Upon Awakening (Second)",
    description: "The Buddha contemplates dependent co-arising in reverse order just after his awakening.",
    fetter: "ignorance",
    tags: "ud,ud1,awakening,dependent co-arising,wise attention,ignorance",
    id: "ud1.2",
    path: "/ud/ud1/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud1.2.pli": {
    title: "Dutiyabodhi sutta - Upon Awakening (Second)",
    description: "The Buddha contemplates dependent co-arising in reverse order just after his awakening.",
    fetter: "ignorance",
    tags: "ud,ud1,awakening,dependent origination, dependent co-arising,dependent co-arising,wise attention,ignorance",
    id: "ud1.2",
    path: "/ud/ud1/",
    updatedTime: "2024-08-02T13:12:23.000Z"
  },
  "ud1.3.en": {
    title: "Tatiyabodhi sutta - Upon Awakening (Third)",
    description: "The Buddha contemplates dependent co-arising in forward and reverse order just after his awakening.",
    fetter: "ignorance",
    tags: "ud,ud1,awakening,dependent co-arising,wise attention,ignorance",
    id: "ud1.3",
    path: "/ud/ud1/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud1.3.pli": {
    title: "Tatiyabodhi sutta - Upon Awakening (Third)",
    description: "The Buddha contemplates dependent co-arising in forward and reverse order just after his awakening.",
    fetter: "ignorance",
    tags: "ud,ud1,awakening,dependent origination, dependent co-arising,wise attention,ignorance",
    id: "ud1.3",
    path: "/ud/ud1/",
    updatedTime: "2024-08-02T13:12:23.000Z"
  },
  "ud2.3.en": {
    title: "Da\u1E47\u1E0Da sutta - On stick",
    description: "He who, while seeking his own happiness, harms with a stick beings who desire happiness, will not find happiness after passing away.",
    fetter: "ill-will",
    tags: "ud,ud2,loving-kindness,harm,bodily misconduct,bodily conduct",
    id: "ud2.3",
    path: "/ud/ud2/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud2.3.pli": {
    title: "Da\u1E47\u1E0Da sutta - On stick",
    description: "He who, while seeking his own happiness, harms with a stick beings who desire happiness, will not find happiness after passing away.",
    fetter: "ill-will",
    tags: "ud,ud2,loving-kindness,harm,bodily misconduct,bodily conduct",
    id: "ud2.3",
    path: "/ud/ud2/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud2.4.en": {
    title: "Sakk\u0101ra sutta - On Honor",
    description: "The Buddha explains how to deal with insult and abuse without arising resentment.",
    fetter: "ill-will",
    tags: "ud,ud2,ill-will,loving-kindness,attachment,blame,honor",
    id: "ud2.4",
    path: "/ud/ud2/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud2.4.pli": {
    title: "Sakk\u0101ra sutta - On Honor",
    description: "The Buddha explains how to deal with insult and abuse without arising resentment.",
    fetter: "ill-will",
    tags: "ud,ud2,ill-will,loving-kindness,attachment,blame,honor",
    id: "ud2.4",
    path: "/ud/ud2/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud2.7.en": {
    title: "Ekaputtaka sutta - Only Young Son",
    description: "Inspired utterance on practicing diligently to leave behind what seems pleasant.",
    fetter: "sensual desire",
    tags: "ud,ud2,attachment,sorrow,misfortune",
    id: "ud2.7",
    path: "/ud/ud2/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud2.7.pli": {
    title: "Ekaputtaka sutta - Only Young Son",
    description: "Inspired utterance on practicing diligently to leave behind what seems pleasant.",
    fetter: "sensual desire",
    tags: "ud,ud2,attachment,sorrow",
    id: "ud2.7",
    path: "/ud/ud2/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud5.1.en": {
    title: "Piyatara sutta - Dearer",
    description: "King Pasenadi of Kosala and Queen Mallik\u0101 discuss who is dearer to them.",
    fetter: "ignorance",
    tags: "dear,ud,ud5",
    id: "ud5.1",
    path: "/ud/ud5/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud5.1.pli": {
    title: "Piyatara sutta - Dearer",
    description: "King Pasenadi of Kosala and Queen Mallik\u0101 discuss who is dearer to them.",
    fetter: "ignorance",
    tags: "dear,ud,ud5",
    id: "ud5.1",
    path: "/ud/ud5/",
    updatedTime: "2024-09-14T16:19:58.000Z"
  },
  "ud5.4.en": {
    title: "Kum\u0101raka sutta - Boys",
    description: "If suffering is displeasing to you, do not commit evil deeds, whether openly or in secret.",
    fetter: "ignorance",
    tags: "suffering, evil deeds, dukkha, ud, ud5",
    id: "ud5.4",
    path: "/ud/ud5/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud5.4.pli": {
    title: "Kum\u0101raka sutta - Boys",
    description: "If suffering is displeasing to you, do not commit evil deeds, whether openly or in secret.",
    fetter: "ignorance",
    tags: "suffering, evil deeds, dukkha, ud, ud5",
    id: "ud5.4",
    path: "/ud/ud5/",
    updatedTime: "2024-09-14T01:16:00.000Z"
  },
  "ud5.9.en": {
    title: "Sadh\u0101yam\u0101na sutta - Mocking",
    description: "The Blessed One sees a group of young br\u0101hma\u1E47as passing by, appearing to be mocking.",
    fetter: "ignorance",
    tags: "mocking,ignorance,ud,ud5",
    id: "ud5.9",
    path: "/ud/ud5/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud5.9.pli": {
    title: "Sadh\u0101yam\u0101na sutta - Mocking",
    description: "The Blessed One sees a group of young br\u0101hma\u1E47as passing by, appearing to be mocking.",
    fetter: "ignorance",
    tags: "mocking,ignorance,ud,ud5",
    id: "ud5.9",
    path: "/ud/ud5/",
    updatedTime: "2024-09-14T16:19:58.000Z"
  },
  "ud6.9.en": {
    title: "Up\u0101tidh\u0101vanti sutta - Moths Rushing to the Flame",
    description: "The Buddha observes moths drawn to the light of oil lamps, and reflects on the nature of attachment.",
    fetter: "sensual desire",
    tags: "ud,ud6,mind,attachment,misfortune",
    id: "ud6.9",
    path: "/ud/ud6/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud6.9.pli": {
    title: "Up\u0101tidh\u0101vanti sutta - Moths Rushing to the Flame",
    description: "The Buddha observes moths drawn to the light of oil lamps, and reflects on the nature of attachment.",
    fetter: "sensual desire",
    tags: "ud,ud6,mind,attachment,misfortune",
    id: "ud6.9",
    path: "/ud/ud6/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud8.1.en": {
    title: "Pa\u1E6Dhamanibb\u0101napa\u1E6Disa\u1E41yutta sutta - First Discourse on Nibb\u0101na",
    description: "The Blessed One instructs the bhikkhus on the base where there is no coming, going, staying, no passing away, and no arising.",
    fetter: "ignorance",
    tags: "ud,ud8,Nibb\u0101na,mindful,base,\u0101yatana,wisdom",
    id: "ud8.1",
    path: "/ud/ud8/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud8.1.pli": {
    title: "Pa\u1E6Dhamanibb\u0101napa\u1E6Disa\u1E41yutta sutta - First Discourse on Nibb\u0101na",
    description: "The Blessed One instructs the bhikkhus on the base where there is no coming, going, staying, no passing away, and no arising.",
    fetter: "ignorance",
    tags: "ud,ud8,Nibb\u0101na,mindful,base,\u0101yatana,wisdom",
    id: "ud8.1",
    path: "/ud/ud8/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud8.3.en": {
    title: "Tatiyanibb\u0101napa\u1E6Disa\u1E41yutta sutta - Third Discourse on Nibb\u0101na",
    description: "The Blessed One instructs the bhikkhus on the unborn, unbecome, unmade, unconditioned.",
    fetter: "ignorance",
    tags: "ud,ud8,Nibb\u0101na,mindful,unconditioned,unborn,wisdom",
    id: "ud8.3",
    path: "/ud/ud8/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud8.3.pli": {
    title: "Tatiyanibb\u0101napa\u1E6Disa\u1E41yutta sutta - Third Discourse on Nibb\u0101na",
    description: "The Blessed One instructs the bhikkhus on the unborn, unbecome, unmade, unconditioned.",
    fetter: "ignorance",
    tags: "ud,ud8,Nibb\u0101na,mindful,unconditioned,unborn,wisdom",
    id: "ud8.3",
    path: "/ud/ud8/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  },
  "ud8.8.en": {
    title: "Vis\u0101kh\u0101 sutta - Discourse to Vis\u0101kh\u0101",
    description: "The Blessed One teaches Vis\u0101kh\u0101 on the nature of attachment and suffering.",
    fetter: "sensual desire",
    tags: "ud,ud8,attachment,dear ones,sorrow,suffering,Vis\u0101kh\u0101",
    id: "ud8.8",
    path: "/ud/ud8/",
    updatedTime: "2024-09-22T12:49:23.000Z"
  },
  "ud8.8.pli": {
    title: "Vis\u0101kh\u0101 sutta - Discourse to Vis\u0101kh\u0101",
    description: "The Blessed One teaches Vis\u0101kh\u0101 on the nature of attachment and suffering.",
    fetter: "sensual desire",
    tags: "ud,ud8,attachment,dear ones,sorrow,suffering,Vis\u0101kh\u0101",
    id: "ud8.8",
    path: "/ud/ud8/",
    updatedTime: "2024-07-21T08:28:54.000Z"
  }
};

// src/contexts/FrontMatterContext.tsx
import { jsx as jsx29 } from "react/jsx-runtime";
var FrontMatterContext = createContext6(
  void 0
);
var CACHE_DURATION = 1 * 60 * 60 * 1e3;
var FrontMatterProvider = ({
  children
}) => {
  const [dfrontMatter, setFrontMatter] = useState9(frontMatter_default);
  useEffect8(() => {
    if (!dfrontMatter) {
      fetchFrontMatter().then((data) => {
        setFrontMatter(data);
        localStorage.setItem("frontMatter", JSON.stringify(data));
        localStorage.setItem("frontMatterTimestamp", Date.now().toString());
      }).catch((error) => console.error("Failed to fetch frontMatter:", error));
    }
  }, [dfrontMatter]);
  return /* @__PURE__ */ jsx29(FrontMatterContext.Provider, { value: { dfrontMatter, setFrontMatter }, children });
};
var useFrontMatter = () => {
  const context = useContext6(FrontMatterContext);
  if (!context) {
    throw new Error("useFrontMatter must be used within a FrontMatterProvider");
  }
  return context;
};

// src/index.tsx
import { useMDXComponents } from "nextra/mdx";
import {
  Callout,
  Steps,
  Tabs,
  Tab,
  Cards,
  Card,
  FileTree
} from "nextra/components";
import { useTheme as useTheme3 } from "next-themes";
import { Fragment as Fragment11, jsx as jsx30, jsxs as jsxs20 } from "react/jsx-runtime";
var classes4 = {
  toc: cn17(
    "nextra-toc nx-order-last nx-hidden nx-w-64 nx-shrink-0 xl:nx-block print:nx-hidden"
  ),
  main: cn17("nx-w-full nx-break-words")
};
var Body = ({
  themeContext,
  breadcrumb,
  timestamp,
  navigation,
  children
}) => {
  var _a;
  const config = useConfig();
  const mounted = useMounted8();
  if (themeContext.layout === "raw") {
    return /* @__PURE__ */ jsx30("div", { className: classes4.main, children });
  }
  const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;
  const gitTimestampEl = mounted && date ? /* @__PURE__ */ jsx30("div", { className: "nx-mt-12 nx-mb-8 nx-block nx-text-xs nx-text-gray-500 ltr:nx-text-right rtl:nx-text-left dark:nx-text-gray-400", children: renderComponent(config.gitTimestamp, { timestamp: date }) }) : /* @__PURE__ */ jsx30("div", { className: "nx-mt-16" });
  const content = /* @__PURE__ */ jsxs20(Fragment11, { children: [
    children,
    gitTimestampEl,
    navigation
  ] });
  const body = ((_a = config.main) == null ? void 0 : _a.call(config, { children: content })) || content;
  if (themeContext.layout === "full") {
    return /* @__PURE__ */ jsx30(
      "article",
      {
        className: cn17(
          classes4.main,
          "nextra-content nx-min-h-[calc(100vh-var(--nextra-navbar-height))] nx-pl-[max(env(safe-area-inset-left),1.5rem)] nx-pr-[max(env(safe-area-inset-right),1.5rem)]"
        ),
        children: body
      }
    );
  }
  return /* @__PURE__ */ jsx30(
    "article",
    {
      className: cn17(
        classes4.main,
        "nextra-content nx-flex nx-min-h-[calc(100vh-var(--nextra-navbar-height))] nx-min-w-0 nx-justify-center nx-pb-8 nx-pr-[calc(env(safe-area-inset-right)-1.5rem)]",
        themeContext.typesetting === "article" && "nextra-body-typesetting-article"
      ),
      children: /* @__PURE__ */ jsxs20("main", { className: "nx-w-full nx-min-w-0 nx-max-w-6xl nx-px-6 nx-pt-4 md:nx-px-12", children: [
        breadcrumb,
        body
      ] })
    }
  );
};
var InnerLayout = ({
  filePath,
  pageMap,
  frontMatter,
  headings,
  timestamp,
  children
}) => {
  const config = useConfig();
  const { locale = DEFAULT_LOCALE, defaultLocale } = useRouter8();
  const fsRoute = useFSRoute3();
  const { dfrontMatter: contextFrontMatter } = useFrontMatter();
  if (typeof window !== "undefined") {
    sessionStorage.setItem("lastParagraphText", "");
  }
  const fsPath = useMemo5(() => {
    if (contextFrontMatter) {
      const key = `${fsRoute.split("/").pop()}.en`;
      if (contextFrontMatter[key]) {
        return contextFrontMatter[key].fullPath ? contextFrontMatter[key].fullPath.split("#")[0].replace(/\.[a-z]{2,3}$/, "") : contextFrontMatter[key].path + fsRoute.split("/").pop();
      }
    }
    return fsRoute;
  }, [fsRoute, contextFrontMatter]);
  console.log("fs path: ", fsPath);
  const {
    activeType,
    activeIndex,
    activeThemeContext,
    activePath,
    topLevelNavbarItems,
    docsDirectories,
    flatDirectories,
    flatDocsDirectories,
    directories
  } = useMemo5(() => {
    const result = normalizePages({
      list: pageMap,
      locale,
      defaultLocale,
      route: fsPath
    });
    return result;
  }, [pageMap, locale, defaultLocale, fsPath]);
  const themeContext = __spreadValues(__spreadValues({}, activeThemeContext), frontMatter);
  const hideSidebar = !themeContext.sidebar || themeContext.layout === "raw" || activeType === "page";
  const tocEl = activeType === "page" || !themeContext.toc || themeContext.layout !== "default" ? themeContext.layout !== "full" && themeContext.layout !== "raw" && /* @__PURE__ */ jsx30("nav", { className: classes4.toc, "aria-label": "table of contents" }) : /* @__PURE__ */ jsx30(
    "nav",
    {
      className: cn17(classes4.toc, "nx-px-4"),
      "aria-label": "table of contents",
      children: renderComponent(config.toc.component, {
        headings: config.toc.float ? headings : [],
        filePath
      })
    }
  );
  const localeConfig = config.i18n.find((l) => l.locale === locale);
  const isRTL = localeConfig ? localeConfig.direction === "rtl" : config.direction === "rtl";
  const direction = isRTL ? "rtl" : "ltr";
  return /* @__PURE__ */ jsxs20("div", { dir: direction, children: [
    /* @__PURE__ */ jsx30(
      "script",
      {
        dangerouslySetInnerHTML: {
          __html: `document.documentElement.setAttribute('dir','${direction}')`
        }
      }
    ),
    /* @__PURE__ */ jsx30(Head, {}),
    /* @__PURE__ */ jsx30(Banner, {}),
    themeContext.navbar && renderComponent(config.navbar.component, {
      flatDirectories,
      items: topLevelNavbarItems
    }),
    /* @__PURE__ */ jsx30(
      "div",
      {
        className: cn17(
          "nx-mx-auto nx-flex",
          themeContext.layout !== "raw" && "nx-max-w-[90rem]"
        ),
        children: /* @__PURE__ */ jsxs20(ActiveAnchorProvider, { children: [
          /* @__PURE__ */ jsx30(
            Sidebar,
            {
              docsDirectories,
              flatDirectories,
              fullDirectories: directories,
              headings,
              asPopover: hideSidebar,
              includePlaceholder: themeContext.layout === "default"
            }
          ),
          tocEl,
          /* @__PURE__ */ jsx30(SkipNavContent, {}),
          /* @__PURE__ */ jsxs20(
            Body,
            {
              themeContext,
              breadcrumb: activeType !== "page" && themeContext.breadcrumb ? /* @__PURE__ */ jsx30(Breadcrumb, { activePath }) : null,
              timestamp,
              navigation: activeType !== "page" && themeContext.pagination ? /* @__PURE__ */ jsx30(
                NavLinks,
                {
                  flatDirectories: flatDocsDirectories,
                  currentIndex: activeIndex
                }
              ) : null,
              children: [
                /* @__PURE__ */ jsx30(
                  MDXProvider,
                  {
                    components: getComponents({
                      isRawLayout: themeContext.layout === "raw",
                      components: config.components
                    }),
                    children
                  }
                ),
                frontMatter.commentary && /* @__PURE__ */ jsxs20(Fragment11, { children: [
                  /* @__PURE__ */ jsx30("hr", { style: { marginTop: "2rem" } }),
                  /* @__PURE__ */ jsx30(
                    "div",
                    {
                      style: {
                        marginTop: "1rem",
                        marginBottom: "1rem",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.92rem"
                      },
                      children: /* @__PURE__ */ jsx30(Markdown, { children: frontMatter.commentary })
                    }
                  )
                ] })
              ]
            }
          )
        ] })
      }
    ),
    themeContext.footer && renderComponent(config.footer.component, { menu: hideSidebar })
  ] });
};
function Layout(_a) {
  var _b = _a, {
    children
  } = _b, context = __objRest(_b, [
    "children"
  ]);
  return /* @__PURE__ */ jsx30(FrontMatterProvider, { children: /* @__PURE__ */ jsx30(ConfigProvider, { value: context, children: /* @__PURE__ */ jsx30(InnerLayout, __spreadProps(__spreadValues({}, context.pageOpts), { children })) }) });
}
export {
  Bleed,
  Callout,
  Card,
  Cards,
  Collapse,
  FileTree,
  Link,
  LocaleSwitch,
  Navbar,
  NotFoundPage,
  ServerSideErrorPage,
  SkipNavContent,
  SkipNavLink,
  Steps,
  Tab,
  Tabs,
  ThemeSwitch,
  Layout as default,
  useConfig,
  useMDXComponents,
  useTheme3 as useTheme
};
