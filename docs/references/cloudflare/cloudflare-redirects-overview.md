---
title: Redirects · Cloudflare Rules docs
description: URL forwarding, also known as URL redirection, navigates the user
  from a source URL to a target URL with a specific HTTP status code.
lastUpdated: 2025-10-06T10:46:53.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/rules/url-forwarding/
  md: https://developers.cloudflare.com/rules/url-forwarding/index.md
---

URL forwarding, also known as URL redirection, navigates the user from a source URL to a target URL with a specific HTTP status code.

Use the following Cloudflare products to perform URL redirects, according to your use case:

* [**Single Redirects**](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/): Allow you to create static or dynamic redirects at the zone level. A simple interface with [wildcard support](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/#wildcard-matching) lets you easily define source and target URL patterns without needing complex functions or regular expressions, efficiently covering thousands of URLs with a single rule.

* [**Bulk Redirects**](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/): Allow you to define a large number of redirects at the account level. These URL redirects are essentially static — they do not support string replacement operations or regular expressions. However, you can configure parameters that affect the redirects' URL matching behavior and their runtime behavior.

* [**Snippets**](https://developers.cloudflare.com/rules/snippets/): Use short pieces of JavaScript code for a more flexible way to define complex redirect functionality. Consider a few [examples](https://developers.cloudflare.com/rules/snippets/examples/?operation=Redirect) to get started.

Note

Single Redirects and Bulk Redirects require that you [proxy the DNS records](https://developers.cloudflare.com/dns/proxy-status/) of your domain (or subdomain) through Cloudflare.

## Redirect Rules templates

Cloudflare provides you with rules templates for common use cases.

1. In the Cloudflare dashboard, go to the Rules **Overview** page.

   [Go to **Overview**](https://dash.cloudflare.com/?to=/:account/:zone/rules/overview)

2. Select **Templates**, and then select one of the available templates.

You can also refer to the [Examples gallery](https://developers.cloudflare.com/rules/examples/) in the developer docs.

## Availability

Single Redirects and Bulk Redirects are available on all Cloudflare plans. The exact quotas and features depend on your plan.

### Bulk redirects

| | Free | Pro | Business | Enterprise |
| - | - | - | - | - |
| Availability | Yes | Yes | Yes | Yes |
| Bulk Redirect Rules | 15 | 15 | 15 | 50 |
| Bulk Redirect Lists | 5 | 5 | 5 | 25 |
| URL redirects across lists | 10,000 | 25,000 | 50,000 | 1,000,000 |

For *URL redirects across lists*, this table provides the default quota for the Enterprise plan. Bulk Redirects supports several million URL redirects — to get more redirects, contact your account team.

Bulk Redirects features and quotas are per account and they depend on the highest Cloudflare plan on your account.

### Single Redirects

| | Free | Pro | Business | Enterprise |
| - | - | - | - | - |
| Availability | Yes | Yes | Yes | Yes |
| Number of rules | 10 | 25 | 50 | 300 |
| Wildcard support | Yes | Yes | Yes | Yes |
| Regex support | No | No | Yes | Yes |

Single Redirects features and quotas are per zone and depend on the zone plan.

## Execution order

The execution order of Rules features is the following:

* [Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/)
* [URL Rewrite Rules](https://developers.cloudflare.com/rules/transform/url-rewrite/)
* [Configuration Rules](https://developers.cloudflare.com/rules/configuration-rules/)
* [Origin Rules](https://developers.cloudflare.com/rules/origin-rules/)
* [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/)
* [Managed Transforms](https://developers.cloudflare.com/rules/transform/managed-transforms/)
* [Request Header Transform Rules](https://developers.cloudflare.com/rules/transform/request-header-modification/)
* [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
* [Snippets](https://developers.cloudflare.com/rules/snippets/)
* [Cloud Connector](https://developers.cloudflare.com/rules/cloud-connector/)

The different types of rules listed above will take precedence over [Page Rules](https://developers.cloudflare.com/rules/page-rules/). This means that Page Rules will be overridden if there is a match for both Page Rules and the Rules products listed above.

Generally speaking, for [non-terminating actions](https://developers.cloudflare.com/ruleset-engine/rules-language/actions/) the last change made by rules in the same [phase](https://developers.cloudflare.com/ruleset-engine/about/phases/) will win (later rules can overwrite changes done by previous rules). However, for terminating actions (*Block*, *Redirect*, or one of the challenge actions), rule evaluation will stop and the action will be executed immediately.

For example, if multiple rules with the *Redirect* action match, Cloudflare will always use the URL redirect of the first rule that matches. Also, if you configure URL redirects using different Cloudflare products (Single Redirects and Bulk Redirects), the product executed first will apply, if there is a rule match (in this case, Single Redirects).

Refer to the [Phases list](https://developers.cloudflare.com/ruleset-engine/reference/phases-list/) for the product execution order.

Warning

Using Cloudflare challenges along with Rules features may cause challenge loops. Refer to [Rules troubleshooting](https://developers.cloudflare.com/rules/reference/troubleshooting/) for more information.

## Troubleshooting

When troubleshooting URL redirects, use [Cloudflare Trace](https://developers.cloudflare.com/rules/trace-request/) to determine if a rule is triggering for a specific URL.

