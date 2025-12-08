---
title: Overview · Cloudflare Rules docs
description: Use Cloudflare Rules to adjust requests and responses, configure
  settings, and trigger actions for specific requests.
lastUpdated: 2025-08-20T13:33:03.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/rules/
  md: https://developers.cloudflare.com/rules/index.md
---

Available on all plans

Cloudflare Rules allows you to make adjustments to requests and responses, configure Cloudflare settings, and trigger specific actions for matching requests.

Rules features require that you [proxy the DNS records](https://developers.cloudflare.com/dns/proxy-status/) of your domain (or subdomain) through Cloudflare.

***

## Features

### Configuration Rules

Customize Cloudflare configuration settings for matching incoming requests.

[Use Configuration Rules](https://developers.cloudflare.com/rules/configuration-rules/)

### Snippets

Customize the behavior of your website or application using short pieces of JavaScript code.

[Use Snippets](https://developers.cloudflare.com/rules/snippets/)

### Transform Rules

Adjust the URI path, query string, and HTTP headers of requests and responses on the Cloudflare global network.

[Use Transform Rules](https://developers.cloudflare.com/rules/transform/)

### Redirects

Redirect visitors from a source URL to a target URL with a specific HTTP status code. Use Single Redirects or Bulk Redirects depending on your use case.

[Use Redirects](https://developers.cloudflare.com/rules/url-forwarding/)

### Origin Rules

Customize where the incoming traffic will go and with which parameters. Override request properties such as `Host` header, destination hostname, and destination port.

[Use Origin Rules](https://developers.cloudflare.com/rules/origin-rules/)

### Cloud Connector

Route matching incoming traffic from your website to a public cloud provider such as AWS, Google Cloud, and Azure.

[Use Cloud Connector](https://developers.cloudflare.com/rules/cloud-connector/)

### Compression Rules

Customize the compression applied to responses from Cloudflare's global network to your website visitors, based on the file extension and content type.

[Use Compression Rules](https://developers.cloudflare.com/rules/compression-rules/)

### Page Rules

Trigger certain actions when a request matches a URL pattern.

[Use Page Rules](https://developers.cloudflare.com/rules/page-rules/)

### URL normalization

Modify the URLs of incoming requests so that they conform to a consistent formatting standard.

[Configure URL normalization](https://developers.cloudflare.com/rules/normalization/)

### Custom Errors

Define what custom content to serve for errors returned by an origin server or by a Cloudflare product, including Workers.

[Configure Custom Errors](https://developers.cloudflare.com/rules/custom-errors/)

***

## Related products

**[Custom rules](https://developers.cloudflare.com/waf/custom-rules/)**

Control incoming traffic by filtering requests to a zone. You can block or challenge incoming requests according to rules you define.

**[Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)**

Define rate limits for requests matching an expression, and the action to perform when those rate limits are reached.

**[Cache rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)**

Customize the cache properties of your HTTP requests.

**[Workers](https://developers.cloudflare.com/workers/)**

Cloudflare Workers provides a serverless execution environment that allows you to create new applications or augment existing ones without configuring or maintaining infrastructure.

***

## More resources

[Plans](https://www.cloudflare.com/plans/#overview)

Compare available Cloudflare plans
