---
title: Create a redirect rule via API · Cloudflare Rules docs
description: Use the Rulesets API to create a redirect rule via API.
lastUpdated: 2025-08-22T14:24:45.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/
  md: https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/index.md
---

Use the [Rulesets API](https://developers.cloudflare.com/ruleset-engine/rulesets-api/) to create a redirect rule via API.

Add redirect rules to the entry point ruleset of the `http_request_dynamic_redirect` phase at the zone level. Refer to the [Rulesets API](https://developers.cloudflare.com/ruleset-engine/rulesets-api/) documentation for more information on [creating a ruleset](https://developers.cloudflare.com/ruleset-engine/rulesets-api/create/) and supplying a list of rules for the ruleset.

Note

Single Redirects require that the incoming traffic for the hostname referenced in visitors' requests is [proxied by Cloudflare](https://developers.cloudflare.com/dns/proxy-status/).

## Basic rule settings

A redirect rule must have:

* `action` set to `redirect`
* An `action_parameters` object with additional configuration settings — refer to [Available settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/) for details.

## Example requests

The following request of the [Create a zone ruleset](https://developers.cloudflare.com/api/resources/rulesets/methods/create/) operation creates a phase entry point ruleset for the `http_request_dynamic_redirect` phase at the zone level, and defines a single redirect rule with a dynamic URL redirect. Use this operation if you have not created a phase entry point ruleset for the `http_request_dynamic_redirect` phase yet.

Required API token permissions

At least one of the following [token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) is required:

* `Response Compression Write`
* `Config Settings Write`
* `Dynamic URL Redirects Write`
* `Cache Settings Write`
* `Custom Errors Write`
* `Origin Write`
* `Managed headers Write`
* `Zone Transform Rules Write`
* `Mass URL Redirects Write`
* `Magic Firewall Write`
* `L4 DDoS Managed Ruleset Write`
* `HTTP DDoS Managed Ruleset Write`
* `Sanitize Write`
* `Transform Rules Write`
* `Select Configuration Write`
* `Bot Management Write`
* `Zone WAF Write`
* `Account WAF Write`
* `Account Rulesets Write`
* `Logs Write`
* `Logs Write`

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{
    "name": "Redirect rules ruleset",
    "kind": "zone",
    "phase": "http_request_dynamic_redirect",
    "rules": [
        {
            "ref": "redirect_gb_fr_to_localized",
            "expression": "(ip.src.country eq \"GB\" or ip.src.country eq \"FR\") and http.request.uri.path eq \"/\"",
            "description": "Redirect GB and FR users in home page to localized site.",
            "action": "redirect",
            "action_parameters": {
                "from_value": {
                    "target_url": {
                        "expression": "lower(concat(\"https://\", ip.src.country, \".example.com\"))"
                    },
                    "status_code": 307,
                    "preserve_query_string": true
                }
            }
        }
    ]
  }'
```

Response

```json
{
  "result": {
    "id": "528f4f03bf0da53a29907199625867be",
    "name": "Redirect rules ruleset",
    "kind": "zone",
    "version": "1",
    "rules": [
      {
        "ref": "redirect_gb_fr_to_localized",
        "id": "235e557b92fd4e5e8753ee665a9ddd75",
        "version": "1",
        "expression": "(ip.src.country eq \"GB\" or ip.src.country eq \"FR\") and http.request.uri.path eq \"/\"",
        "description": "Redirect GB and FR users in home page to localized site.",
        "action": "redirect",
        "action_parameters": {
          "from_value": {
            "target_url": {
              "expression": "lower(concat(\"https://\", ip.src.country, \".example.com\"))"
            },
            "status_code": 307,
            "preserve_query_string": true
          }
        },
        "last_updated": "2022-09-28T09:20:42Z"
      }
    ],
    "last_updated": "2022-09-28T09:20:42Z",
    "phase": "http_request_dynamic_redirect"
  },
  "success": true,
  "errors": [],
  "messages": []
}
```

Use the `ref` field to get stable rule IDs across updates when using Terraform. Adding this field prevents Terraform from recreating the rule on changes. For more information, refer to [Troubleshooting](https://developers.cloudflare.com/terraform/troubleshooting/rule-id-changes/#how-to-keep-the-same-rule-id-between-modifications) in the Terraform documentation.

If there is already a phase entry point ruleset for the `http_request_dynamic_redirect` phase, use the [Update a zone ruleset](https://developers.cloudflare.com/api/resources/rulesets/methods/update/) operation instead, like in the following example:

Required API token permissions

At least one of the following [token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) is required:

* `Response Compression Write`
* `Config Settings Write`
* `Dynamic URL Redirects Write`
* `Cache Settings Write`
* `Custom Errors Write`
* `Origin Write`
* `Managed headers Write`
* `Zone Transform Rules Write`
* `Mass URL Redirects Write`
* `Magic Firewall Write`
* `L4 DDoS Managed Ruleset Write`
* `HTTP DDoS Managed Ruleset Write`
* `Sanitize Write`
* `Transform Rules Write`
* `Select Configuration Write`
* `Bot Management Write`
* `Zone WAF Write`
* `Account WAF Write`
* `Account Rulesets Write`
* `Logs Write`
* `Logs Write`

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/$RULESET_ID" \
  --request PUT \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{
    "name": "Redirect rules ruleset",
    "kind": "zone",
    "phase": "http_request_dynamic_redirect",
    "rules": [
        {
            "ref": "redirect_gb_fr_to_localized",
            "expression": "(ip.src.country eq \"GB\" or ip.src.country eq \"FR\") and http.request.uri.path eq \"/\"",
            "description": "Redirect GB and FR users in home page to localized site.",
            "action": "redirect",
            "action_parameters": {
                "from_value": {
                    "target_url": {
                        "expression": "lower(concat(\"https://\", ip.src.country, \".example.com\"))"
                    },
                    "status_code": 307,
                    "preserve_query_string": true
                }
            }
        },
        {
            "ref": "redirect_contacts_to_new_page",
            "expression": "http.request.uri.path eq \"/contacts.html\"",
            "description": "Redirect to new contacts page.",
            "action": "redirect",
            "action_parameters": {
                "from_value": {
                    "target_url": {
                        "value": "https://example.com/contact-us/"
                    },
                    "status_code": 308
                }
            }
        }
    ]
  }'
```

Response

```json
{
  "result": {
    "id": "528f4f03bf0da53a29907199625867be",
    "name": "Redirect rules ruleset",
    "description": "",
    "kind": "zone",
    "version": "2",
    "rules": [
      {
        "ref": "redirect_gb_fr_to_localized",
        "id": "235e557b92fd4e5e8753ee665a9ddd75",
        "version": "1",
        "action": "redirect",
        "action_parameters": {
          "from_value": {
            "target_url": {
              "expression": "lower(concat(\"https://\", ip.src.country, \".example.com\"))"
            },
            "status_code": 307,
            "preserve_query_string": true
          }
        },
        "expression": "(ip.src.country eq \"GB\" or ip.src.country eq \"FR\") and http.request.uri.path eq \"/\"",
        "description": "Redirect GB and FR users in home page to localized site.",
        "last_updated": "2022-10-03T15:38:51.658387Z",
        "ref": "235e557b92fd4e5e8753ee665a9ddd75",
        "enabled": true
      },
      {
        "ref": "redirect_contacts_to_new_page",
        "id": "cfad5efbfcd1440fb5b30cf30f95ece3",
        "version": "1",
        "action": "redirect",
        "action_parameters": {
          "from_value": {
            "target_url": {
              "value": "https://example.com/contact-us/"
            },
            "status_code": 308
          }
        },
        "expression": "http.request.uri.path eq \"/contacts.html\"",
        "description": "Redirect to new contacts page.",
        "last_updated": "2022-10-03T15:38:51.658387Z",
        "ref": "cfad5efbfcd1440fb5b30cf30f95ece3",
        "enabled": true
      }
    ],
    "last_updated": "2022-10-03T15:38:51.658387Z",
    "phase": "http_request_dynamic_redirect"
  },
  "success": true,
  "errors": [],
  "messages": []
}
```

***

## Required API token permissions

The API token used in API requests to manage redirect rules must have at least the following permission:

* *Zone* > *Single Redirect* > *Edit*

