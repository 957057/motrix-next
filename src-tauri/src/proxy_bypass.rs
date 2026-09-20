//! Normalize user input for libcurl's native NO_PROXY matcher.
use crate::error::AppError;
use serde_json::Value;

pub fn normalize(input: &str) -> Result<String, AppError> {
    let mut entries = Vec::new();
    for entry in input
        .split([',', ';', '\n', '\r'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let value = if entry == "*" {
            entry.to_owned()
        } else if let Ok(network) = entry.parse::<ipnet::IpNet>() {
            network.trunc().to_string()
        } else if let Ok(address) = entry
            .trim_start_matches('[')
            .trim_end_matches(']')
            .parse::<std::net::IpAddr>()
        {
            address.to_string()
        } else if let Ok(url::Host::Domain(domain)) =
            url::Host::parse(entry.trim_start_matches('.'))
        {
            if domain.is_empty()
                || !domain
                    .bytes()
                    .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, b'-' | b'.'))
            {
                return Err(invalid(entry));
            }
            domain
        } else {
            return Err(invalid(entry));
        };
        if !entries.contains(&value) {
            entries.push(value);
        }
    }
    Ok(entries.join(","))
}

fn invalid(entry: &str) -> AppError {
    AppError::InvalidInput(format!(
        "Unsupported proxy bypass entry: {entry}. Use a host, domain, IP, CIDR network, or *; separate entries with newlines or commas."
    ))
}

pub fn normalize_options(options: &mut serde_json::Map<String, Value>) -> Result<(), AppError> {
    if let Some(value) = options.get_mut("no-proxy") {
        let input = value
            .as_str()
            .ok_or_else(|| AppError::InvalidInput("no-proxy must be text".into()))?;
        *value = normalize(input)?.into();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_multiline_and_system_lists_for_curl() {
        assert_eq!(
            normalize(" 10.0.0.1\r\n10.0.0.2; localhost,10.0.0.1 ").unwrap(),
            "10.0.0.1,10.0.0.2,localhost"
        );
        assert_eq!(
            normalize(".EXAMPLE.com\n[::1]\n10.0.0.7/8").unwrap(),
            "example.com,::1,10.0.0.0/8"
        );
        assert_eq!(normalize("*\n*").unwrap(), "*");
        assert_eq!(normalize("\n , ; ").unwrap(), "");
    }

    #[test]
    fn rejects_rules_curl_cannot_interpret() {
        for value in [
            "<local>",
            "127.*",
            "*.local",
            "https://example.com",
            "host:8080",
            "10.0.0.0/99",
            "a=b",
            "bad host",
        ] {
            assert!(normalize(value).is_err(), "{value}");
        }
    }
}
