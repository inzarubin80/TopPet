package model

import "testing"

func TestEmailDomainMatchesAllowlist(t *testing.T) {
	allowed := []string{"acme.com", "example.org"}
	if !EmailDomainMatchesAllowlist("User@Acme.COM", allowed) {
		t.Fatal("exact domain match")
	}
	if !EmailDomainMatchesAllowlist("x@mail.acme.com", allowed) {
		t.Fatal("subdomain match")
	}
	if EmailDomainMatchesAllowlist("x@notacme.com", allowed) {
		t.Fatal("suffix trap")
	}
	if EmailDomainMatchesAllowlist("x@acme.com.evil", allowed) {
		t.Fatal("must not match parent as suffix incorrectly")
	}
	if EmailDomainMatchesAllowlist("", allowed) {
		t.Fatal("empty email")
	}
	if !EmailDomainMatchesAllowlist("a@b.example.org", []string{"example.org"}) {
		t.Fatal("nested subdomain")
	}
}
