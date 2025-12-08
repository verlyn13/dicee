---
title: Proxy status · Cloudflare DNS docs
description: While your DNS records make your website or application available
  to visitors and other web services, the proxy status of a DNS record defines
  how Cloudflare treats incoming DNS queries for that record.
lastUpdated: 2025-09-22T12:43:37.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/dns/proxy-status/
  md: https://developers.cloudflare.com/dns/proxy-status/index.md
---

While your [DNS records](https://developers.cloudflare.com/dns/manage-dns-records/) make your website or application available to visitors and other web services, the proxy status of a DNS record defines how Cloudflare treats incoming DNS queries for that record.

The records you can proxy through Cloudflare are [records used for IP address resolution](https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/#ip-address-resolution) — meaning A, AAAA, or CNAME records.

Cloudflare recommends setting to proxied all A, AAAA, and CNAME records that are used for serving web traffic. For example, CNAME records being used to verify your domain for a third-party service should not be proxied.

Note

Proxying is on by default when you onboard a domain via the dashboard.

### Benefits

When you set a DNS record to **Proxied** (also known as orange-clouded), Cloudflare can:

* Protect your origin server from [DDoS attacks](https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/).
* [Optimize, cache, and protect](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/) all requests to your application.
* Apply your configurations for a variety of Cloudflare products.

Warning

When you [add a domain](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/) to Cloudflare, Cloudflare protection will be in a [pending state](https://developers.cloudflare.com/dns/zone-setups/reference/domain-status/) until we can verify ownership. This could take up to 24 hours to complete. Refer to [Limitations](https://developers.cloudflare.com/dns/proxy-status/limitations/#pending-domains) for further guidance.

### Example

DNS management for **example.com**:

| Type | Name | Content | Proxy status | TTL |
| - | - | - | - | - |
| A | `blog` | `192.0.2.1` | Proxied | Auto |
| A | `shop` | `192.0.2.2` | DNS only | Auto |

In the example DNS table above, there are two DNS records. The record with the name `blog` has proxy on, while the record named `shop` has the proxy off (that is, **DNS only**).

This means that:

* A DNS query to the proxied record `blog.example.com` will be answered with a Cloudflare [anycast IP address](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/) instead of `192.0.2.1`. This ensures that HTTP/HTTPS requests for this name will be sent to Cloudflare's network and can be proxied, which allows the [benefits listed above](#benefits).
* A DNS query to the DNS-only record `shop.example.com` will be answered with the actual origin IP address, `192.0.2.2`. In addition to exposing your origin IP address and not benefitting from several features, Cloudflare cannot provide HTTP/HTTPS analytics on those requests (only DNS analytics).

For further context, refer to [How Cloudflare works](https://developers.cloudflare.com/fundamentals/concepts/how-cloudflare-works/).

***

## Proxied records

The sections below describe specific behaviors and expected outcomes when you have DNS records set to proxied. There may also be some [limitations](https://developers.cloudflare.com/dns/proxy-status/limitations/) in specific scenarios.

### Predefined time to live

By default, all proxied records have a time to live (TTL) of **Auto**, which is set to 300 seconds. This value cannot be edited.

Since only [records used for IP address resolution](https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/#ip-address-resolution) can be proxied, this setting ensures that potential changes to the assigned [anycast IP address](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/) will take effect quickly, as recursive resolvers will not cache them for longer than 300 seconds (five minutes).

Note

It may take longer than five minutes for you to actually experience record changes, as your local DNS cache may take longer to update.

### Mix proxied and unproxied

If you have multiple A or AAAA records on the same name and at least one of them is proxied, Cloudflare will treat all A or AAAA records on this name as being proxied.

Example

DNS management for **example.com**:

| Type | Name | Content | Proxy status | TTL |
| - | - | - | - | - |
| A | `blog` | `192.0.2.1` | Proxied | Auto |
| A | `blog` | `192.0.2.5` | DNS only | Auto |

In this example, all traffic intended for `blog.example.com` will be treated as if both records were **Proxied**.

### Protocol optimization

For proxied records, if your domain has [HTTP/2 or HTTP/3 enabled](https://developers.cloudflare.com/speed/optimization/protocol/) and is also using [Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/), Cloudflare automatically generates corresponding [HTTPS Service (HTTPS) records](https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/#svcb-and-https) on the fly. HTTPS records allow you to provide a client with information about how it should connect to a server upfront, without the need of an initial plaintext HTTP connection.

Note

Both HTTP/2 and HTTP/3 configurations also require that you have an SSL/TLS certificate served by Cloudflare. This means that disabling [Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/), for example, could impact this behavior.

***

## DNS-only records

When an A, AAAA, or CNAME record is **DNS-only** — also known as being gray-clouded — DNS queries for these will resolve to the record's origin IP address, as described in the [example](#example).

In addition to potentially exposing your origin IP addresses to bad actors and [DDoS attacks](https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/), leaving your records as **DNS-only** means that Cloudflare cannot [optimize, cache, and protect](https://developers.cloudflare.com/fundamentals/concepts/how-cloudflare-works/) requests to your application or provide analytics on those requests.

Note

If you have multiple `A/AAAA` records on the same name and at least one of them is proxied, Cloudflare will treat all `A/AAAA` records on this name as being proxied.

