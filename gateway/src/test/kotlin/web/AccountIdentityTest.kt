package web

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import tsproto.Identity
import tsproto.MyTsAccount
import tsproto.MyTsIdentities

class AccountIdentityTest {
    @Test fun automaticallyUsesTheNamedIdentityOfTheCurrentAccount() {
        val current = MyTsAccount.Session("synthetic-a", "A")
        val other = MyTsAccount.Session("synthetic-b", "B")
        fun entry(id: String, name: String): MyTsIdentities.Entry {
            val key = Identity.generate(securityLevel = 0)
            return MyTsIdentities.Entry(id, name, "", key.uid, "fixture-uid", key)
        }
        val first = entry("1", "default")
        val capitalized = entry("5", "Default")
        val duplicate = entry("6", "Default")
        assertNull(automaticAccountIdentity(current, current, listOf(first)))
        assertEquals(first.identity.uid, automaticAccountIdentity(current, current, listOf(first), first.id)?.uid)
        assertEquals(capitalized.identity.uid, automaticAccountIdentity(current, current, listOf(first, capitalized), first.id)?.uid)
        assertNull(automaticAccountIdentity(current, other, listOf(first), first.id))
        assertNull(automaticAccountIdentity(null, current, listOf(first), first.id))
        assertNull(automaticAccountIdentity(current, current, emptyList()))
        assertNull(automaticAccountIdentity(current, current, listOf(first), "missing"))
        assertNull(automaticAccountIdentity(current, current, listOf(capitalized, duplicate)))
        assertEquals(duplicate.identity.uid, automaticAccountIdentity(current, current, listOf(capitalized, duplicate), duplicate.id)?.uid)
    }
}
