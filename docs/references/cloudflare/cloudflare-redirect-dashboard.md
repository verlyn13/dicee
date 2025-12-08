---
title: Create a redirect rule in the dashboard · Cloudflare Rules docs
lastUpdated: 2025-09-24T12:01:01.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/
  md: https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/index.md
---

1. In the Cloudflare dashboard, go to the Rules **Overview** page.

   [Go to **Overview**](https://dash.cloudflare.com/?to=/:account/:zone/rules/overview)

2. Select **Create rule** > **Redirect Rule**.

3. (Optional) Select one of the rule templates that address common use cases. Then, review and adjust the proposed rule configuration.

4. Enter a descriptive name for the rule in **Rule name**.

5. Under **When incoming requests match**, select one of the following options:

   * **Wildcard pattern**: The rule will only apply to traffic matching the wildcard pattern.

     * **Request URL**: Enter the [wildcard pattern](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/#wildcard-matching) using the asterisk (`*`) character to match multiple requests. For example, `http*://*.example.com/files/*`.

     * **Then**: Define the [URL redirect settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/) including:

       * **Target URL**: Enter the target URL, which can be static (for example, `https://example.com`) or dynamic (for example, `https://example.com/${1}/files/${2}`). Use [wildcard replacement](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/#wildcard_replace) such as `${1}` and `${2}` to define dynamic target URLs.
       * **Status code**: Select the status code for the redirect (for example, `301`).
       * **Preserve query string**: Choose whether to keep the query string from the original request.

   * **All incoming requests**: The rule will apply to all traffic.
     * **Then**: Define the [URL redirect settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/) for all incoming requests.

   * **Custom filter expression**: The rule will only apply to traffic matching a custom expression. Define the [rule expression](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/edit-expressions/) to configure which requests should be redirected.
     * **Then**: Define the [URL redirect settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/) for requests matching the custom rule expression.

6. To save and deploy your rule, select **Deploy**. If you are not ready to deploy your rule, select **Save as Draft**.

   If you are matching a hostname in your rule expression, you may be prompted to create a proxied DNS record for that hostname. Refer to [Troubleshooting](https://developers.cloudflare.com/rules/reference/troubleshooting/#this-rule-may-not-apply-to-your-traffic) for more information.

Note

Single Redirects require that the incoming traffic for the hostname referenced in visitors' requests is [proxied by Cloudflare](https://developers.cloudflare.com/dns/proxy-status/).

